import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getChatsForUser, saveChat, deleteChat, clearChats } from '../utils/memory';

const API = 'http://127.0.0.1:8100';
const CHAT_API = 'http://127.0.0.1:9000/chat';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function extractSuggestions(text) {
  if (!text.includes('💡 You can also ask:')) return [text, []];
  const [main, rest] = text.split('💡 You can also ask:');
  const suggs = rest.trim().split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
  return [main.trim(), suggs];
}

export default function ChatPage({ user, onLogout, onNav }) {
  const { uid, profile } = user;
  const [chats, setChats] = useState(() => getChatsForUser(uid));
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Hi ${profile.employee_name} 👋 I'm your Jio Employee Assistant. How can I help you today?`
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sops, setSops] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadPanel, setUploadPanel] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Supported file types for upload
  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

  useEffect(() => {
    fetch(`${API}/api/sops`).then(r => r.json()).then(data => {
      const allSops = data.rows.map(r => Object.fromEntries(data.columns.map((c, i) => [c, r[i]])));
      setSops(allSops.filter(s => s.job_role_code?.toUpperCase() === profile.job_role_code?.toUpperCase()));
    }).catch(() => {});

    // Load user's uploaded files
    fetchUserFiles();
  }, [profile.job_role_code, uid]);

  const fetchUserFiles = async () => {
    try {
      const r = await fetch(`${API}/api/user/files/${uid}`);
      const data = await r.json();
      if (data.rows) {
        setUploadedFiles(data.rows.map(row => Object.fromEntries(data.columns.map((col, i) => [col, row[i]]))));
      }
    } catch (e) {
      console.log('Could not fetch user files');
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`File type .${ext} not allowed.\nAllowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('uid', uid);
      formData.append('file_type', ext.match(/png|jpg|jpeg|gif|bmp|webp/) ? 'snapshot' : 'document');
      formData.append('file_description', '');
      formData.append('file', file);

      const r = await fetch(`${API}/api/user/upload-file`, {
        method: 'POST',
        body: formData
      });

      const data = await r.json();
      if (data.message) {
        setMessages(m => [...m, {
          role: 'assistant',
          content: `✓ ${data.message}\n📄 File: ${file.name}\n📊 Size: ${(file.size / 1024).toFixed(2)} KB`
        }]);
        fetchUserFiles();
      } else {
        setMessages(m => [...m, {
          role: 'assistant',
          content: `✗ Upload failed: ${data.error}`
        }]);
      }
    } catch (e) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `✗ Upload error: ${e.message}`
      }]);
    } finally {
      setUploadLoading(false);
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch(`${CHAT_API}?uid=${encodeURIComponent(uid)}&message=${encodeURIComponent(text.trim())}`, {
        method: 'POST',
      });
      const data = await r.json();
      const answer = data.answer || 'No response received.';
      const withAnswer = [...newMsgs, { role: 'assistant', content: answer }];
      setMessages(withAnswer);

      // Save to memory
      const chatId = currentChatId || genId();
      const chatObj = { id: chatId, title: text.trim().slice(0, 40), messages: withAnswer };
      saveChat(uid, chatObj);
      setCurrentChatId(chatId);
      setChats(getChatsForUser(uid));
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ Could not reach the assistant server. Make sure it is running on port 9000.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, loading, uid, currentChatId]);

  function newChat() {
    setCurrentChatId(null);
    setMessages([{ role: 'assistant', content: `Hi ${profile.employee_name} 👋 Starting a new conversation. How can I help?` }]);
    setInput('');
  }

  function loadChat(chat) {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
  }

  function handleDeleteChat(e, chatId) {
    e.stopPropagation();
    deleteChat(uid, chatId);
    setChats(getChatsForUser(uid));
    if (currentChatId === chatId) newChat();
  }

  function handleClearAll() {
    clearChats(uid);
    setChats([]);
    newChat();
  }

  const roleInitials = (profile.employee_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#04060f', overflow: 'hidden' }}>
      <style>{`
        .sidebar-btn {
          width: 100%; text-align: left; padding: 10px 12px;
          background: transparent; border: none; color: #7a8aaa;
          border-radius: 8px; font-size: 13px; cursor: pointer;
          transition: background 0.15s, color 0.15s;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sidebar-btn:hover { background: rgba(255,255,255,0.05); color: #f0f4ff; }
        .sidebar-btn.active { background: rgba(0,153,255,0.1); color: #0099ff; }
        .msg-user {
          background: #0099ff; color: #fff;
          padding: 12px 16px; border-radius: 14px 14px 4px 14px;
          max-width: 72%; margin-left: auto; font-size: 14px; line-height: 1.6;
        }
        .msg-bot {
          background: #0c1120; border: 1px solid rgba(255,255,255,0.06);
          color: #e0e8f8; padding: 14px 16px;
          border-radius: 4px 14px 14px 14px;
          max-width: 82%; font-size: 14px; line-height: 1.7;
          white-space: pre-wrap; word-break: break-word;
        }
        .sugg-btn {
          background: rgba(0,153,255,0.06); border: 1px solid rgba(0,153,255,0.2);
          color: #0099ff; padding: 8px 14px; border-radius: 20px;
          font-size: 12px; cursor: pointer; transition: background 0.15s;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px;
        }
        .sugg-btn:hover { background: rgba(0,153,255,0.15); }
        .chat-input {
          flex: 1; background: transparent; border: none; color: #f0f4ff;
          font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif;
          resize: none; line-height: 1.5; max-height: 120px;
        }
        .chat-input::placeholder { color: #3d4d66; }
        .nav-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; background: transparent; border: none;
          color: #7a8aaa; border-radius: 8px; font-size: 12px; cursor: pointer;
          transition: background 0.15s, color 0.15s; font-family: 'DM Sans', sans-serif;
          width: 100%;
        }
        .nav-btn:hover { background: rgba(255,255,255,0.04); color: #f0f4ff; }
        .typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #0099ff; animation: typingBounce 1.2s infinite;
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .sop-item {
          padding: 8px 10px; border-radius: 8px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 4px; cursor: pointer; transition: background 0.15s;
        }
        .sop-item:hover { background: rgba(0,153,255,0.06); border-color: rgba(0,153,255,0.2); }
        .upload-panel {
          background: rgba(0,102,204,0.1); border: 1px solid rgba(0,153,255,0.3);
          border-radius: 10px; padding: 12px;
          margin-bottom: 12px;
        }
        .file-list {
          max-height: 150px; overflow-y: auto;
          font-size: 11px; color: #7a8aaa;
        }
        .file-item {
          background: rgba(255,255,255,0.02); padding: 6px 8px;
          border-radius: 6px; margin-bottom: 4px;
          display: flex; justify-content: space-between; align-items: center;
        }
      `}</style>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{
          width: 240, minWidth: 240, height: '100vh',
          background: '#070c18', borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Reliance_Jio_Logo.svg/330px-Reliance_Jio_Logo.svg.png"
                  alt="Jio" style={{ width: 26 }} />
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: '#f0f4ff' }}>
                Jio Assistant
              </span>
            </div>
          </div>

          {/* Upload Panel */}
          <div style={{ padding: '12px 10px 0' }}>
            <button onClick={() => setUploadPanel(!uploadPanel)} style={{
              width: '100%', padding: '9px 12px',
              background: 'rgba(0,153,255,0.1)', border: '1px solid rgba(0,153,255,0.2)',
              borderRadius: 9, color: '#0099ff', fontSize: 13, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              transition: 'background 0.15s',
              marginBottom: uploadPanel ? 10 : 0
            }}>
              <span style={{ fontSize: 16 }}>📤</span> Upload File
            </button>

            {uploadPanel && (
              <div className="upload-panel">
                <div style={{ fontSize: 11, color: '#7a8aaa', marginBottom: 8 }}>
                  📁 Supported formats:
                </div>
                <div style={{ fontSize: 10, color: '#5a7a9a', marginBottom: 10 }}>
                  Images: PNG, JPG, GIF, BMP, WebP
                  Documents: PDF, DOCX, DOC, XLSX, XLS, CSV, TXT
                </div>
                <button onClick={() => fileInputRef.current?.click()} style={{
                  width: '100%', padding: '8px',
                  background: 'rgba(0,153,255,0.2)', border: '1px dashed rgba(0,153,255,0.4)',
                  borderRadius: 8, color: '#0099ff', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif'
                }}>
                  {uploadLoading ? 'Uploading...' : 'Click to select file'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                  onChange={handleFileSelect}
                  disabled={uploadLoading}
                />

                {uploadedFiles.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 11, color: '#7a8aaa', marginBottom: 6 }}>
                      📂 Recent uploads: ({uploadedFiles.length})
                    </div>
                    <div className="file-list">
                      {uploadedFiles.slice(0, 5).map((f, i) => (
                        <div key={i} className="file-item">
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.file_name}
                          </span>
                          <span style={{ color: '#5a7a9a', marginLeft: 4 }}>
                            {(f.file_size / 1024).toFixed(0)}KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New Chat */}
          <div style={{ padding: uploadPanel ? '0 10px' : '12px 10px 0' }}>
            <button onClick={newChat} style={{
              width: '100%', padding: '9px 12px',
              background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.2)',
              borderRadius: 9, color: '#00d68f', fontSize: 13, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              transition: 'background 0.15s',
            }}>
              <span style={{ fontSize: 16 }}>+</span> New Chat
            </button>
          </div>

          {/* Chat history */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
            {chats.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: '#3d4d66', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 4px 4px' }}>
                  Recent
                </div>
                {chats.map(chat => (
                  <div key={chat.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <button
                      className={`sidebar-btn ${currentChatId === chat.id ? 'active' : ''}`}
                      onClick={() => loadChat(chat)}
                      style={{ flex: 1 }}
                    >
                      💬 {chat.title}
                    </button>
                    <button onClick={e => handleDeleteChat(e, chat.id)} style={{
                      background: 'none', border: 'none', color: '#3d4d66',
                      cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
                      fontSize: 12, transition: 'color 0.15s',
                    }}
                      onMouseEnter={e => e.target.style.color = '#ff4d6d'}
                      onMouseLeave={e => e.target.style.color = '#3d4d66'}
                    >✕</button>
                  </div>
                ))}
                <button onClick={handleClearAll} style={{
                  marginTop: 6, width: '100%', padding: '7px',
                  background: 'none', border: '1px solid rgba(255,77,109,0.15)',
                  borderRadius: 8, color: '#ff4d6d', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                }}>
                  Clear history
                </button>
              </>
            )}
          </div>

          {/* SOPs */}
          {sops.length > 0 && (
            <div style={{ padding: '0 10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: '#3d4d66', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, paddingLeft: 2 }}>
                Your SOPs
              </div>
              <div style={{ maxHeight: 140, overflow: 'auto' }}>
                {sops.map((sop, i) => (
                  <a key={i} href={`${API}/api/sop/open/${sop.doc_name}`} target="_blank" rel="noreferrer"
                    style={{ display: 'block', textDecoration: 'none' }}>
                    <div className="sop-item">
                      <div style={{ fontSize: 12, color: '#e0e8f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {sop.doc_name?.replace(/\.(pdf|docx)$/i, '')}
                      </div>
                      <div style={{ fontSize: 10, color: '#7a8aaa' }}>v{sop.version}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ padding: '0 10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
            <button className="nav-btn" onClick={() => onNav('admin')}>
              <span>⚙️</span> Admin Panel
            </button>
            <button className="nav-btn" onClick={() => onNav('dashboard')}>
              <span>📊</span> Dashboard
            </button>
            <button className="nav-btn" onClick={onLogout}>
              <span>→</span> Sign Out
            </button>
          </div>

          {/* User chip */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(0,153,255,0.2)', color: '#0099ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, flexShrink: 0,
            }}>{roleInitials}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: '#f0f4ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.employee_name}
              </div>
              <div style={{ fontSize: 10, color: '#7a8aaa' }}>{profile.job_role_text || profile.job_role_code}</div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 12, background: '#04060f',
          flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background: 'none', border: 'none', color: '#7a8aaa', cursor: 'pointer',
            fontSize: 18, padding: 4, borderRadius: 6,
          }}>☰</button>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, color: '#f0f4ff' }}>
              Employee Skill Assistant
            </div>
            <div style={{ fontSize: 11, color: '#7a8aaa' }}>
              {profile.job_role_text} · {profile.org_unit_text || profile.org_unit}
            </div>
          </div>
          <div style={{
            marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%',
            background: '#00d68f', boxShadow: '0 0 6px #00d68f',
          }} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg, i) => {
            if (msg.role === 'user') {
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.25s ease' }}>
                  <div className="msg-user">{msg.content}</div>
                </div>
              );
            }
            const [mainText, suggs] = extractSuggestions(msg.content);
            return (
              <div key={i} style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,153,255,0.15)', flexShrink: 0, marginTop: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>🤖</div>
                  <div className="msg-bot">{mainText}</div>
                </div>
                {suggs.length > 0 && (
                  <div style={{ marginTop: 10, marginLeft: 38, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ width: '100%', fontSize: 11, color: '#7a8aaa', marginBottom: 4 }}>💡 You can also ask:</div>
                    {suggs.map((s, si) => (
                      <button key={si} className="sugg-btn" onClick={() => sendMessage(s)}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,153,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🤖</div>
              <div style={{ display: 'flex', gap: 5, padding: '14px 16px', background: '#0c1120', borderRadius: '4px 14px 14px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} className="typing-dot" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 20px 20px', flexShrink: 0,
          background: 'linear-gradient(to top, #04060f 80%, transparent)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: '#0c1120', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '12px 14px',
            transition: 'border-color 0.2s',
          }}>
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask anything about your SOPs or role... Or upload files!"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              style={{ flex: 1 }}
            />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{
              width: 36, height: 36, borderRadius: 9,
              background: input.trim() && !loading ? '#0099ff' : 'rgba(255,255,255,0.04)',
              border: 'none', color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s', flexShrink: 0, fontSize: 16,
            }}>
              ↑
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#3d4d66', marginTop: 8 }}>
            Enter to send · Shift+Enter for new line · Use upload button for files
          </div>
        </div>
      </div>
    </div>
  );
}
