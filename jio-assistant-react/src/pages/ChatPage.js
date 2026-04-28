import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getChatsForUser, saveChat, deleteChat, clearChats } from '../utils/memory';

const API      = 'http://127.0.0.1:8100';
const CHAT_API = 'http://127.0.0.1:9000/chat';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function extractSuggestions(text) {
  if (!text.includes('💡 You can also ask:')) return [text, []];
  const [main, rest] = text.split('💡 You can also ask:');
  return [main.trim(), rest.trim().split('\n').map(l => l.replace(/^-\s*/,'').trim()).filter(Boolean)];
}

const ACCEPTED_EXTS = ['pdf','docx','doc','xlsx','xls','csv','txt','png','jpg','jpeg','gif','bmp','webp'];
const ACCEPTED_MIME = ACCEPTED_EXTS.map(e=>`.${e}`).join(',');

// ── Voice support detection ──────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const VOICE_SUPPORTED   = !!SpeechRecognition;

export default function ChatPage({ user, onLogout, onNav }) {
  const { uid, profile } = user;

  const [chats, setChats]                 = useState(() => getChatsForUser(uid));
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages]           = useState([{
    role: 'assistant',
    content: `Hi ${profile.employee_name} 👋 I'm your Jio Assistant. Type, upload a file, paste a screenshot, or use 🎤 voice!`,
    ts: Date.now()
  }]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [sops, setSops]                   = useState([]);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [attachedFile, setAttachedFile]   = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode]         = useState(false);   // modal open
  const [listening, setListening]         = useState(false);   // mic active
  const [transcript, setTranscript]       = useState('');      // live transcript
  const [voiceStatus, setVoiceStatus]     = useState('idle');  // idle|listening|processing|done
  const recognitionRef                    = useRef(null);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const fileInputRef = useRef(null);

  // ── Load SOPs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/sops`).then(r => r.json()).then(data => {
      if (!data.rows) return;
      const all = data.rows.map(r => Object.fromEntries(data.columns.map((c,i) => [c, r[i]])));
      setSops(all.filter(s => s.job_role_code?.toUpperCase() === profile.job_role_code?.toUpperCase()));
    }).catch(() => {});
  }, [profile.job_role_code]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Cleanup recognition on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // VOICE LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  const startListening = useCallback(() => {
    if (!VOICE_SUPPORTED) return;

    const recognition = new SpeechRecognition();
    recognition.lang             = 'en-IN';   // Indian English — change if needed
    recognition.continuous       = false;
    recognition.interimResults   = true;
    recognition.maxAlternatives  = 1;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus('listening');
      setTranscript('');
    };

    recognition.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      setListening(false);
      setVoiceStatus('idle');
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone in browser settings.');
      }
    };

    recognition.onend = () => {
      setListening(false);
      // Only move to processing if we have text
      setTranscript(prev => {
        if (prev.trim()) setVoiceStatus('done');
        else             setVoiceStatus('idle');
        return prev;
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const cancelVoice = useCallback(() => {
    recognitionRef.current?.abort();
    setListening(false);
    setTranscript('');
    setVoiceStatus('idle');
    setVoiceMode(false);
  }, []);

  // Called when user hits "Send" in the voice modal
  const sendVoiceQuery = useCallback(() => {
    const text = transcript.trim();
    if (!text) return;
    setVoiceMode(false);
    setVoiceStatus('idle');
    setTranscript('');
    // Feed into normal send pipeline
    sendMessage(text);
  }, [transcript]); // sendMessage added below via ref trick

  // ══════════════════════════════════════════════════════════════════════════
  // FILE ATTACH
  // ══════════════════════════════════════════════════════════════════════════

  const attachFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      alert(`".${ext}" not supported.\nAllowed: ${ACCEPTED_EXTS.join(', ')}`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) { alert('Max file size is 50 MB.'); return; }
    const isImage = ['png','jpg','jpeg','gif','bmp','webp'].includes(ext);
    setAttachedFile({ file, previewUrl: isImage ? URL.createObjectURL(file) : null, isImage, ext });
  }, []);

  const handlePaste = useCallback((e) => {
    const img = Array.from(e.clipboardData?.items || []).find(it => it.type.startsWith('image/'));
    if (!img) return;
    e.preventDefault();
    attachFile(new File([img.getAsFile()], `screenshot_${Date.now()}.png`, { type: 'image/png' }));
  }, [attachFile]);

  const clearAttachment = () => {
    if (attachedFile?.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);
    setAttachedFile(null);
  };

  const uploadToBackend = async (file) => {
    const ext  = file.name.split('.').pop().toLowerCase();
    const form = new FormData();
    form.append('uid', uid);
    form.append('file_type', ['png','jpg','jpeg','gif','bmp','webp'].includes(ext) ? 'snapshot' : 'document');
    form.append('file_description', '');
    form.append('file', file);
    return (await fetch(`${API}/api/user/upload-file`, { method: 'POST', body: form })).json();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ══════════════════════════════════════════════════════════════════════════

  const sendMessage = useCallback(async (text) => {
    if ((!text?.trim() && !attachedFile) || loading) return;

    let userContent = text?.trim() || '';
    if (attachedFile) userContent = userContent
      ? `${userContent}\n📎 ${attachedFile.file.name}`
      : `📎 ${attachedFile.file.name}`;

    const userMsg  = { role: 'user', content: userContent, filePreview: attachedFile?.previewUrl || null, ts: Date.now() };
    const newMsgs  = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    const fileToUpload = attachedFile;
    clearAttachment();

    try {
      let fileContext = '';
      if (fileToUpload) {
        setUploadLoading(true);
        try {
          const res = await uploadToBackend(fileToUpload.file);
          if (res.message) {
            fileContext = `\n[User uploaded: ${fileToUpload.file.name}]`;
            if (res.extracted_text_preview) fileContext += `\nFile preview: ${res.extracted_text_preview}`;
          }
        } catch { fileContext = `\n[File upload failed: ${fileToUpload.file.name}]`; }
        finally  { setUploadLoading(false); }
      }

      const chatText = (text?.trim() || 'Describe the uploaded file.') + fileContext;
      const r    = await fetch(
        `${CHAT_API}?uid=${encodeURIComponent(uid)}&message=${encodeURIComponent(chatText)}`,
        { method: 'POST' }
      );
      const data     = await r.json();
      const answer   = data.answer || 'No response received.';
      const withAnswer = [...newMsgs, { role: 'assistant', content: answer, ts: Date.now() }];
      setMessages(withAnswer);

      const chatId = currentChatId || genId();
      saveChat(uid, {
        id:       chatId,
        title:    (text?.trim() || fileToUpload?.file.name || 'File').slice(0, 40),
        messages: withAnswer
      });
      setCurrentChatId(chatId);
      setChats(getChatsForUser(uid));
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: '⚠️ Could not reach the assistant. Check port 9000.',
        ts: Date.now()
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, loading, uid, currentChatId, attachedFile]);

  // Wire sendVoiceQuery to sendMessage after it's defined
  const sendVoiceQueryFinal = useCallback(() => {
    const text = transcript.trim();
    if (!text) return;
    setVoiceMode(false);
    setVoiceStatus('idle');
    setTranscript('');
    sendMessage(text);
  }, [transcript, sendMessage]);

  // ── Chat helpers ──────────────────────────────────────────────────────────
  function newChat() {
    setCurrentChatId(null); clearAttachment();
    setMessages([{ role: 'assistant', content: `Hi ${profile.employee_name} 👋 New conversation!`, ts: Date.now() }]);
    setInput('');
  }
  function loadChat(c)  { setCurrentChatId(c.id); setMessages(c.messages); }
  function handleDeleteChat(e, id) {
    e.stopPropagation(); deleteChat(uid, id); setChats(getChatsForUser(uid));
    if (currentChatId === id) newChat();
  }

  const fmt          = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const roleInitials = (profile.employee_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ display:'flex', width:'100%', height:'100vh', background:'#eef2fb', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#c5d3f0;border-radius:4px;}

        .sb-btn{width:100%;text-align:left;padding:8px 11px;background:transparent;border:none;
          color:#5a6a8a;border-radius:10px;font-size:13px;cursor:pointer;
          font-family:'DM Sans',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          transition:background .15s,color .15s;}
        .sb-btn:hover,.sb-btn.active{background:rgba(37,99,235,.08);color:#2563eb;}

        .msg-user{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;
          padding:11px 15px;border-radius:18px 18px 4px 18px;max-width:72%;
          margin-left:auto;font-size:14px;line-height:1.6;white-space:pre-wrap;
          box-shadow:0 2px 10px rgba(37,99,235,.25);}
        .msg-bot{background:#fff;border:1px solid #dde6f5;color:#1e293b;
          padding:12px 15px;border-radius:4px 18px 18px 18px;max-width:80%;
          font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;
          box-shadow:0 1px 6px rgba(0,0,0,.05);}

        .sugg-btn{background:#fff;border:1px solid #bfdbfe;color:#2563eb;padding:6px 13px;
          border-radius:20px;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;
          transition:all .15s;box-shadow:0 1px 3px rgba(0,0,0,.06);}
        .sugg-btn:hover{background:#2563eb;color:#fff;border-color:#2563eb;}

        .chat-input{flex:1;background:transparent;border:none;color:#1e293b;
          font-size:14px;outline:none;font-family:'DM Sans',sans-serif;
          resize:none;line-height:1.5;max-height:120px;}
        .chat-input::placeholder{color:#94a3b8;}

        .typing-dot{width:7px;height:7px;border-radius:50%;background:#2563eb;
          animation:bounce 1.2s infinite;}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}

        .send-btn{width:36px;height:36px;border-radius:50%;flex-shrink:0;
          background:#2563eb;border:none;color:#fff;cursor:pointer;
          display:flex;align-items:center;justify-content:center;font-size:15px;
          transition:background .2s;box-shadow:0 2px 8px rgba(37,99,235,.3);}
        .send-btn:disabled{background:#c5d3f0;box-shadow:none;cursor:not-allowed;}
        .send-btn:not(:disabled):hover{background:#1d4ed8;}

        .nav-btn{display:flex;align-items:center;gap:7px;width:100%;padding:8px 10px;
          background:transparent;border:none;color:#5a6a8a;border-radius:9px;
          font-size:12px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
        .nav-btn:hover{background:rgba(37,99,235,.07);color:#2563eb;}

        .input-bar{display:flex;align-items:flex-end;gap:10px;background:#fff;
          border:1.5px solid #dde6f5;border-radius:20px;padding:10px 14px;
          transition:border-color .2s;box-shadow:0 2px 12px rgba(0,0,0,.06);}
        .input-bar:focus-within{border-color:#93c5fd;}

        .attach-chip{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
          padding:7px 10px;display:flex;align-items:center;gap:8px;margin-bottom:6px;}

        /* ── Voice modal ── */
        .voice-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);
          backdrop-filter:blur(4px);z-index:1000;
          display:flex;align-items:center;justify-content:center;}
        .voice-modal{background:#fff;border-radius:24px;
          padding:36px 32px;width:340px;text-align:center;
          box-shadow:0 20px 60px rgba(0,0,0,.15);position:relative;}

        /* Ripple ring around mic when listening */
        .mic-ring{position:relative;width:90px;height:90px;margin:0 auto 20px;}
        .mic-ring::before,.mic-ring::after{
          content:'';position:absolute;inset:0;border-radius:50%;
          border:2px solid #2563eb;opacity:0;
          animation:ripple 1.6s ease-out infinite;}
        .mic-ring::after{animation-delay:.8s;}
        @keyframes ripple{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.8);opacity:0}}

        .mic-btn-large{width:90px;height:90px;border-radius:50%;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;font-size:34px;
          transition:all .2s;position:relative;z-index:1;}
        .mic-btn-large.idle{background:#eff6ff;color:#2563eb;box-shadow:0 4px 16px rgba(37,99,235,.2);}
        .mic-btn-large.idle:hover{background:#dbeafe;transform:scale(1.05);}
        .mic-btn-large.active{background:#2563eb;color:#fff;box-shadow:0 4px 20px rgba(37,99,235,.4);}

        /* Transcript box in modal */
        .transcript-box{background:#f8faff;border:1.5px solid #dde6f5;border-radius:12px;
          padding:14px 16px;min-height:64px;text-align:left;font-size:15px;
          color:#1e293b;line-height:1.6;margin:16px 0;word-break:break-word;
          font-style:italic;}
        .transcript-box.empty{color:#94a3b8;font-style:normal;}

        .voice-action-row{display:flex;gap:10px;justify-content:center;margin-top:4px;}
        .v-btn{padding:10px 20px;border-radius:12px;font-size:14px;
          font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;
          transition:all .15s;border:none;}
        .v-btn.primary{background:#2563eb;color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.3);}
        .v-btn.primary:hover{background:#1d4ed8;}
        .v-btn.primary:disabled{background:#c5d3f0;box-shadow:none;cursor:not-allowed;}
        .v-btn.ghost{background:#f1f5f9;color:#64748b;}
        .v-btn.ghost:hover{background:#e2e8f0;}

        .voice-mic-btn{background:none;border:none;color:#64748b;cursor:pointer;
          font-size:18px;padding:2px 5px;flex-shrink:0;line-height:1;
          transition:color .15s;border-radius:8px;}
        .voice-mic-btn:hover{color:#2563eb;}
        .voice-mic-btn.recording{color:#ef4444;animation:pulse .8s infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          VOICE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {voiceMode && (
        <div className="voice-overlay" onClick={e => { if (e.target === e.currentTarget) cancelVoice(); }}>
          <div className="voice-modal">
            {/* Close */}
            <button onClick={cancelVoice} style={{
              position:'absolute', top:14, right:16, background:'none', border:'none',
              color:'#94a3b8', cursor:'pointer', fontSize:18, lineHeight:1
            }}>✕</button>

            <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700,
              color:'#1e293b', marginBottom:4 }}>Voice Assistant</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:24 }}>
              {voiceStatus === 'idle'      && 'Tap the mic to start speaking'}
              {voiceStatus === 'listening' && '🔴 Listening… speak now'}
              {voiceStatus === 'done'      && 'Done — review and send, or re-record'}
            </div>

            {/* Mic button with ripple ring when active */}
            <div className="mic-ring" style={{ '--show-ring': listening ? 1 : 0 }}>
              {/* Only animate ring when listening */}
              {listening && (
                <>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%',
                    border:'2px solid #2563eb', animation:'ripple 1.6s ease-out infinite', opacity:.6 }} />
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%',
                    border:'2px solid #2563eb', animation:'ripple 1.6s ease-out .8s infinite', opacity:.6 }} />
                </>
              )}
              <button
                className={`mic-btn-large ${listening ? 'active' : 'idle'}`}
                onClick={listening ? stopListening : startListening}
              >
                {listening ? '⏹' : '🎤'}
              </button>
            </div>

            {/* Live transcript */}
            <div className={`transcript-box ${!transcript ? 'empty' : ''}`}>
              {transcript || (listening ? '…' : 'Your speech will appear here')}
            </div>

            {/* Action buttons */}
            <div className="voice-action-row">
              {voiceStatus === 'done' && (
                <>
                  <button className="v-btn ghost" onClick={() => { setTranscript(''); setVoiceStatus('idle'); }}>
                    Re-record
                  </button>
                  <button className="v-btn primary" onClick={sendVoiceQueryFinal}
                    disabled={!transcript.trim()}>
                    Send ↑
                  </button>
                </>
              )}
              {voiceStatus === 'listening' && (
                <button className="v-btn ghost" onClick={stopListening}>
                  Stop listening
                </button>
              )}
              {voiceStatus === 'idle' && (
                <button className="v-btn ghost" onClick={cancelVoice}>
                  Cancel
                </button>
              )}
            </div>

            {!VOICE_SUPPORTED && (
              <div style={{ marginTop:12, fontSize:12, color:'#ef4444', background:'#fef2f2',
                padding:'8px 12px', borderRadius:8, border:'1px solid #fecaca' }}>
                ⚠️ Your browser doesn't support voice input.<br/>
                Try Chrome or Edge on desktop.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div style={{ width:230, minWidth:230, height:'100vh', background:'#fff',
          borderRight:'1px solid #dde6f5', display:'flex', flexDirection:'column',
          overflow:'hidden', boxShadow:'2px 0 10px rgba(0,0,0,.04)' }}>

          {/* Logo */}
          <div style={{ padding:'16px 14px 13px', borderBottom:'1px solid #dde6f5',
            display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#2563eb',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Reliance_Jio_Logo.svg/330px-Reliance_Jio_Logo.svg.png"
                alt="Jio" style={{ width:22, filter:'brightness(0) invert(1)' }} />
            </div>
            <span style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'#1e293b' }}>
              Jio Assistant
            </span>
          </div>

          {/* New chat */}
          <div style={{ padding:'11px 11px 0' }}>
            <button onClick={newChat} style={{
              width:'100%', padding:'9px', background:'#2563eb', border:'none',
              borderRadius:12, color:'#fff', fontSize:13, cursor:'pointer',
              fontFamily:'DM Sans,sans-serif', fontWeight:600,
              boxShadow:'0 2px 8px rgba(37,99,235,.3)', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#1d4ed8'}
              onMouseLeave={e => e.currentTarget.style.background='#2563eb'}>
              + New Chat
            </button>
          </div>

          {/* Chat history */}
          <div style={{ flex:1, overflow:'auto', padding:'8px 10px' }}>
            {chats.length > 0 && <>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase',
                letterSpacing:'1px', padding:'10px 4px 5px' }}>Recent</div>
              {chats.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:3, marginBottom:2 }}>
                  <button className={`sb-btn ${currentChatId === c.id ? 'active' : ''}`}
                    onClick={() => loadChat(c)} style={{ flex:1 }}>
                    💬 {c.title}
                  </button>
                  <button onClick={e => handleDeleteChat(e, c.id)} style={{
                    background:'none', border:'none', color:'#cbd5e1', cursor:'pointer',
                    padding:'4px 6px', borderRadius:6, fontSize:13, transition:'color .15s' }}
                    onMouseEnter={e => e.target.style.color='#ef4444'}
                    onMouseLeave={e => e.target.style.color='#cbd5e1'}>✕</button>
                </div>
              ))}
              <button onClick={() => { clearChats(uid); setChats([]); newChat(); }} style={{
                marginTop:6, width:'100%', padding:'6px', background:'none',
                border:'1px solid #fecaca', borderRadius:9, color:'#ef4444',
                fontSize:11, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                Clear history
              </button>
            </>}
          </div>

          {/* SOPs */}
          {sops.length > 0 && (
            <div style={{ padding:'0 10px 10px', borderTop:'1px solid #dde6f5', paddingTop:10 }}>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase',
                letterSpacing:'1px', marginBottom:6 }}>Your SOPs</div>
              <div style={{ maxHeight:130, overflow:'auto' }}>
                {sops.map((s, i) => (
                  <a key={i} href={`${API}/api/sop/open/${s.doc_name}`} target="_blank" rel="noreferrer"
                    style={{ display:'block', textDecoration:'none' }}>
                    <div style={{ padding:'7px 9px', borderRadius:9, background:'#f8faff',
                      border:'1px solid #dde6f5', marginBottom:3, cursor:'pointer', transition:'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background='#f8faff'}>
                      <div style={{ fontSize:12, color:'#1e293b', overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        📄 {s.doc_name?.replace(/\.(pdf|docx)$/i, '')}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Nav */}
          <div style={{ padding:'0 10px 10px', borderTop:'1px solid #dde6f5', paddingTop:8 }}>
            {[['⚙️','Admin Panel','admin'],['📊','Dashboard','dashboard']].map(([icon,label,page]) => (
              <button key={page} className="nav-btn" onClick={() => onNav(page)}>{icon} {label}</button>
            ))}
            <button className="nav-btn" onClick={onLogout}>→ Sign Out</button>
          </div>

          {/* User chip */}
          <div style={{ padding:'10px 14px', borderTop:'1px solid #dde6f5',
            display:'flex', alignItems:'center', gap:9, background:'#f8faff' }}>
            <div style={{ width:30, height:30, borderRadius:'50%',
              background:'linear-gradient(135deg,#2563eb,#60a5fa)',
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700, flexShrink:0 }}>{roleInitials}</div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontSize:12, color:'#1e293b', fontWeight:600,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile.employee_name}
              </div>
              <div style={{ fontSize:10, color:'#64748b' }}>
                {profile.job_role_text || profile.job_role_code}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CHAT
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'12px 20px', borderBottom:'1px solid #dde6f5',
          display:'flex', alignItems:'center', gap:10,
          background:'#fff', flexShrink:0, boxShadow:'0 1px 6px rgba(0,0,0,.04)' }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background:'none', border:'none', color:'#64748b', cursor:'pointer',
            fontSize:18, padding:4, borderRadius:8, transition:'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color='#2563eb'}
            onMouseLeave={e => e.currentTarget.style.color='#64748b'}>☰</button>
          <div style={{ width:34, height:34, borderRadius:'50%',
            background:'linear-gradient(135deg,#2563eb,#60a5fa)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🤖</div>
          <div>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'#1e293b' }}>
              Employee Skill Assistant
            </div>
            <div style={{ fontSize:11, color:'#64748b' }}>
              {profile.job_role_text} · {profile.org_unit_text || ''}
            </div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5,
            fontSize:11, color:'#22c55e', fontWeight:500 }}>
            <div style={{ width:7, height:7, borderRadius:'50%',
              background:'#22c55e', boxShadow:'0 0 5px #22c55e' }} /> Online
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflow:'auto', padding:'20px 22px',
          display:'flex', flexDirection:'column', gap:12 }}>

          {messages.map((msg, i) => {
            if (msg.role === 'user') return (
              <div key={i} style={{ display:'flex', flexDirection:'column',
                alignItems:'flex-end', animation:'fadeUp .25s ease' }}>
                {msg.filePreview && (
                  <img src={msg.filePreview} alt="attachment"
                    style={{ maxWidth:200, maxHeight:150, borderRadius:12, marginBottom:5,
                      border:'2px solid #bfdbfe', objectFit:'contain',
                      boxShadow:'0 2px 8px rgba(0,0,0,.08)' }} />
                )}
                <div className="msg-user">{msg.content}</div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>{fmt(msg.ts)}</div>
              </div>
            );

            const [mainText, suggs] = extractSuggestions(msg.content);
            return (
              <div key={i} style={{ animation:'fadeUp .3s ease' }}>
                <div style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, marginTop:2,
                    background:'linear-gradient(135deg,#2563eb,#60a5fa)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🤖</div>
                  <div>
                    <div className="msg-bot">{mainText}</div>
                    <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, marginLeft:2 }}>
                      {fmt(msg.ts)}
                    </div>
                  </div>
                </div>
                {suggs.length > 0 && (
                  <div style={{ marginTop:8, marginLeft:39, display:'flex', flexWrap:'wrap', gap:7 }}>
                    <div style={{ width:'100%', fontSize:11, color:'#64748b', marginBottom:4 }}>
                      💡 You can also ask:
                    </div>
                    {suggs.map((s, si) => (
                      <button key={si} className="sugg-btn" onClick={() => sendMessage(s)}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {(loading || uploadLoading) && (
            <div style={{ display:'flex', gap:9, alignItems:'center' }}>
              <div style={{ width:30, height:30, borderRadius:'50%',
                background:'linear-gradient(135deg,#2563eb,#60a5fa)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🤖</div>
              <div style={{ display:'flex', gap:5, padding:'11px 15px', background:'#fff',
                borderRadius:'4px 18px 18px 18px', border:'1px solid #dde6f5',
                boxShadow:'0 1px 6px rgba(0,0,0,.05)' }}>
                {uploadLoading
                  ? <span style={{ fontSize:12, color:'#64748b' }}>Uploading…</span>
                  : [0,.2,.4].map((d, i) => (
                      <div key={i} className="typing-dot" style={{ animationDelay:`${d}s` }} />
                    ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── INPUT BAR ─────────────────────────────────────────────────────── */}
        <div style={{ padding:'10px 20px 16px', flexShrink:0,
          background:'linear-gradient(to top,#eef2fb 85%,transparent)' }}>

          {/* File attachment chip */}
          {attachedFile && (
            <div className="attach-chip">
              {attachedFile.isImage
                ? <img src={attachedFile.previewUrl} alt="preview"
                    style={{ width:38, height:38, objectFit:'cover',
                      borderRadius:7, border:'1px solid #bfdbfe' }} />
                : <span style={{ fontSize:20 }}>
                    {attachedFile.ext==='pdf'?'📕':attachedFile.ext==='xlsx'?'📗':attachedFile.ext==='docx'?'📘':'📄'}
                  </span>
              }
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:12, color:'#1e293b', fontWeight:500,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {attachedFile.file.name}
                </div>
                <div style={{ fontSize:10, color:'#64748b' }}>
                  {(attachedFile.file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button onClick={clearAttachment} style={{
                background:'none', border:'none', color:'#ef4444',
                cursor:'pointer', fontSize:16, padding:'2px 5px' }}>✕</button>
            </div>
          )}

          <div className="input-bar"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drop-active'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drop-active')}
            onDrop={e => { e.currentTarget.classList.remove('drop-active'); if (e.dataTransfer.files[0]) attachFile(e.dataTransfer.files[0]); }}>

            {/* 📎 File picker */}
            <button onClick={() => fileInputRef.current?.click()} title="Attach file"
              style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer',
                fontSize:18, padding:'2px 4px', flexShrink:0, lineHeight:1, transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#2563eb'}
              onMouseLeave={e => e.currentTarget.style.color='#94a3b8'}>📎</button>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_MIME} style={{ display:'none' }}
              onChange={e => { if (e.target.files[0]) attachFile(e.target.files[0]); e.target.value=''; }} />

            {/* Text area */}
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Type a message… or paste screenshot (Ctrl+V)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              rows={1}
              style={{ flex:1 }}
            />

            {/* 🎤 Voice button */}
            {VOICE_SUPPORTED && (
              <button
                className={`voice-mic-btn${listening ? ' recording' : ''}`}
                onClick={() => { setVoiceMode(true); setVoiceStatus('idle'); setTranscript(''); }}
                title="Voice input"
              >🎤</button>
            )}

            {/* Send */}
            <button className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && !attachedFile)}>↑</button>
          </div>

          <div style={{ textAlign:'center', fontSize:10, color:'#94a3b8', marginTop:6 }}>
            Enter to send · Shift+Enter for newline · Ctrl+V to paste screenshot · 📎 attach · 🎤 voice
          </div>
        </div>
      </div>
    </div>
  );
}
