import React, { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8100';

const SECTIONS = ['Add User', 'Upload SOP', 'Skills Registry', 'Assign Skill', 'View Tables'];

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input {...props} style={{
      width: '100%', padding: '10px 12px',
      background: '#0e1828', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8, color: '#f0f4ff', fontSize: 13, outline: 'none',
      fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s',
      ...props.style,
    }}
      onFocus={e => e.target.style.borderColor = 'rgba(0,153,255,0.5)'}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
    />
  );
}

function Select({ options, ...props }) {
  return (
    <select {...props} style={{
      width: '100%', padding: '10px 12px',
      background: '#0e1828', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8, color: '#f0f4ff', fontSize: 13, outline: 'none',
      fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
    }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function SaveBtn({ onClick, loading, label = 'Save' }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      padding: '10px 24px', background: '#0099ff', border: 'none',
      borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600,
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif',
      opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
    }}>
      {loading ? 'Saving...' : label}
    </button>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: type === 'success' ? 'rgba(0,214,143,0.15)' : 'rgba(255,77,109,0.15)',
      border: `1px solid ${type === 'success' ? 'rgba(0,214,143,0.3)' : 'rgba(255,77,109,0.3)'}`,
      borderRadius: 10, padding: '12px 18px', color: type === 'success' ? '#00d68f' : '#ff4d6d',
      fontSize: 13, animation: 'fadeIn 0.3s ease',
    }}>
      {msg}
    </div>
  );
}

function DataTable({ columns, rows }) {
  if (!rows?.length) return <div style={{ color: '#7a8aaa', fontSize: 13, textAlign: 'center', padding: 24 }}>No data found</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c} style={{
                padding: '8px 12px', textAlign: 'left', color: '#7a8aaa',
                borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap',
                fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 10,
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '9px 12px', color: '#c0ccdd',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ADD USER ───
function AddUser({ showToast }) {
  const [form, setForm] = useState({
    uid: '', employee_code: '', employee_name: '',
    job_role_code: '', job_role_text: '', date_of_joining: '',
    org_unit: '', job_work_area: '', job_work_stream: '',
    function: '', sub_function: '', company: '', state: '',
    region: '', facility: '', category_l1: '', l1_employee_code: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setLoading(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch(`${API}/api/user/add`, { method: 'POST', body: fd });
    setLoading(false);
    showToast(r.ok ? ['User added successfully', 'success'] : ['Failed to add user', 'error']);
  }

  const fields = [
    ['uid', 'UID *'], ['employee_code', 'Employee Code'], ['employee_name', 'Employee Name'],
    ['job_role_code', 'Job Role Code'], ['job_role_text', 'Job Role Text'], ['date_of_joining', 'Date of Joining'],
    ['org_unit', 'Org Unit'], ['job_work_area', 'Job Work Area'], ['job_work_stream', 'Job Work Stream'],
    ['function', 'Function'], ['sub_function', 'Sub Function'], ['company', 'Company'],
    ['state', 'State'], ['region', 'Region'], ['facility', 'Facility'],
    ['category_l1', 'Category L1'], ['l1_employee_code', 'L1 Employee Code'],
  ];

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#f0f4ff' }}>
        Add User Profile
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
        {fields.map(([key, label]) => (
          <Field key={key} label={label}>
            <Input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={label} />
          </Field>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <SaveBtn onClick={save} loading={loading} label="Add User" />
      </div>
    </div>
  );
}

// ─── UPLOAD SOP ───
function UploadSOP({ showToast }) {
  const [form, setForm] = useState({ doc_name: '', job_role_code: '', job_role_text: '', version: 'v1.0' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function upload() {
    if (!file) { showToast(['Please select a file', 'error']); return; }
    setLoading(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', file);
    const r = await fetch(`${API}/api/sop/upload`, { method: 'POST', body: fd });
    setLoading(false);
    showToast(r.ok ? ['SOP uploaded successfully', 'success'] : ['Upload failed', 'error']);
    if (r.ok) setFile(null);
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#f0f4ff' }}>
        Upload SOP Document
      </h2>
      <div style={{ maxWidth: 520 }}>
        {[['doc_name', 'Document Name'], ['job_role_code', 'Job Role Code'], ['job_role_text', 'Job Role Text'], ['version', 'Version']].map(([k, l]) => (
          <Field key={k} label={l}>
            <Input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={l} />
          </Field>
        ))}
        <Field label="SOP File (PDF / DOCX)">
          <div style={{
            border: `2px dashed ${file ? 'rgba(0,153,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
            onClick={() => document.getElementById('sop-file').click()}
          >
            <input id="sop-file" type="file" accept=".pdf,.docx" style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])} />
            {file
              ? <div style={{ color: '#0099ff', fontSize: 13 }}>📄 {file.name}</div>
              : <div style={{ color: '#7a8aaa', fontSize: 13 }}>Click to select file</div>
            }
          </div>
        </Field>
        <SaveBtn onClick={upload} loading={loading} label="Upload SOP" />
      </div>
    </div>
  );
}

// ─── SKILLS REGISTRY ───
function SkillsRegistry({ showToast }) {
  const [form, setForm] = useState({ skill_id: '', skill_name: '', proficiency: 'MEDIUM', criticality: 'MEDIUM' });
  const [skills, setSkills] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { loadSkills(); }, []);
  async function loadSkills() {
    const r = await fetch(`${API}/api/skills`);
    if (r.ok) setSkills(await r.json());
  }
  async function save() {
    setLoading(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch(`${API}/api/skill/add`, { method: 'POST', body: fd });
    setLoading(false);
    if (r.ok) { showToast(['Skill added', 'success']); loadSkills(); }
    else showToast(['Failed', 'error']);
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#f0f4ff' }}>Skills Registry</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', maxWidth: 520 }}>
        <Field label="Skill ID"><Input value={form.skill_id} onChange={e => set('skill_id', e.target.value)} placeholder="e.g. TH001" /></Field>
        <Field label="Skill Name"><Input value={form.skill_name} onChange={e => set('skill_name', e.target.value)} /></Field>
        <Field label="Proficiency"><Select options={['LOW', 'MEDIUM', 'HIGH']} value={form.proficiency} onChange={e => set('proficiency', e.target.value)} /></Field>
        <Field label="Criticality"><Select options={['LOW', 'MEDIUM', 'HIGH']} value={form.criticality} onChange={e => set('criticality', e.target.value)} /></Field>
      </div>
      <div style={{ marginBottom: 24 }}><SaveBtn onClick={save} loading={loading} label="Add Skill" /></div>
      <div style={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable {...skills} />
      </div>
    </div>
  );
}

// ─── ASSIGN SKILL ───
function AssignSkill({ showToast }) {
  const [uid, setUid] = useState('');
  const [skillList, setSkillList] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [userSkills, setUserSkills] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/skills`).then(r => r.json()).then(data => {
      setSkillList(data.rows.map(r => ({ id: r[0], name: r[1] })));
    });
  }, []);

  async function assign() {
    if (!uid || !selectedSkill) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('uid', uid); fd.append('skill_id', selectedSkill);
    const r = await fetch(`${API}/api/user-skill/add`, { method: 'POST', body: fd });
    setLoading(false);
    showToast(r.ok ? ['Skill assigned', 'success'] : ['Failed', 'error']);
    if (r.ok) loadUserSkills();
  }

  async function loadUserSkills() {
    if (!uid) return;
    const r = await fetch(`${API}/api/user-skills/${uid}`);
    if (r.ok) setUserSkills(await r.json());
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 24, color: '#f0f4ff' }}>Assign Skill to User</h2>
      <div style={{ maxWidth: 400, marginBottom: 24 }}>
        <Field label="User UID">
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={uid} onChange={e => setUid(e.target.value)} placeholder="Employee UID" />
            <button onClick={loadUserSkills} style={{
              padding: '10px 16px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              color: '#f0f4ff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
              fontFamily: 'DM Sans, sans-serif',
            }}>Load</button>
          </div>
        </Field>
        <Field label="Select Skill">
          <Select
            options={skillList.length ? skillList.map(s => `${s.id} - ${s.name}`) : ['No skills available']}
            value={selectedSkill}
            onChange={e => setSelectedSkill(e.target.value.split(' - ')[0])}
          />
        </Field>
        <SaveBtn onClick={assign} loading={loading} label="Assign Skill" />
      </div>
      {userSkills && (
        <div style={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#7a8aaa' }}>
            Skills assigned to {uid}
          </div>
          <DataTable {...userSkills} />
        </div>
      )}
    </div>
  );
}

// ─── VIEW TABLES ───
function ViewTables({ showToast }) {
  const [table, setTable] = useState('Users');
  const [data, setData] = useState(null);
  const [roleForm, setRoleForm] = useState({ job_role_code: '', skill_level: 'S2', proficiency: 'MEDIUM', criticality: 'MEDIUM' });
  const [loading, setLoading] = useState(false);

  const TABLES = ['Users', 'SOP Registry', 'Role → Skill Map'];

  async function loadTable(t) {
    setData(null);
    const ep = t === 'Users' ? '/api/users' : t === 'SOP Registry' ? '/api/sops' : '/api/role-skill-map';
    const r = await fetch(`${API}${ep}`);
    if (r.ok) setData(await r.json());
  }

  useEffect(() => { loadTable(table); }, [table]);

  async function saveRoleSkill() {
    setLoading(true);
    const fd = new FormData();
    Object.entries(roleForm).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch(`${API}/api/role-skill-map/save`, { method: 'POST', body: fd });
    setLoading(false);
    showToast(r.ok ? ['Saved', 'success'] : ['Failed', 'error']);
    if (r.ok) loadTable('Role → Skill Map');
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 20, color: '#f0f4ff' }}>View Tables</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TABLES.map(t => (
          <button key={t} onClick={() => setTable(t)} style={{
            padding: '7px 14px',
            background: table === t ? 'rgba(0,153,255,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${table === t ? 'rgba(0,153,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8, color: table === t ? '#0099ff' : '#7a8aaa',
            fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {table === 'Role → Skill Map' && (
        <div style={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, color: '#f0f4ff', marginBottom: 14, fontWeight: 600 }}>
            Add / Update Mapping
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 16px' }}>
            <Field label="Role Code"><Input value={roleForm.job_role_code} onChange={e => setRoleForm(f => ({ ...f, job_role_code: e.target.value }))} /></Field>
            <Field label="Skill Level"><Select options={['S1', 'S2', 'S3']} value={roleForm.skill_level} onChange={e => setRoleForm(f => ({ ...f, skill_level: e.target.value }))} /></Field>
            <Field label="Proficiency"><Select options={['LOW', 'MEDIUM', 'HIGH']} value={roleForm.proficiency} onChange={e => setRoleForm(f => ({ ...f, proficiency: e.target.value }))} /></Field>
            <Field label="Criticality"><Select options={['LOW', 'MEDIUM', 'HIGH']} value={roleForm.criticality} onChange={e => setRoleForm(f => ({ ...f, criticality: e.target.value }))} /></Field>
          </div>
          <SaveBtn onClick={saveRoleSkill} loading={loading} label="Save Mapping" />
        </div>
      )}

      <div style={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        {data ? <DataTable {...data} /> : (
          <div style={{ padding: 24, textAlign: 'center', color: '#7a8aaa', fontSize: 13 }}>Loading...</div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ADMIN PAGE ───
export default function AdminPage({ user, onNav }) {
  const [section, setSection] = useState('Add User');
  const [toast, setToast] = useState(null);

  function showToast([msg, type]) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const SECTION_ICONS = {
    'Add User': '👤', 'Upload SOP': '📄', 'Skills Registry': '🎯', 'Assign Skill': '🔗', 'View Tables': '📊'
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#04060f', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, minWidth: 220, background: '#070c18',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: '#f0f4ff' }}>Admin Panel</div>
          <div style={{ fontSize: 11, color: '#7a8aaa', marginTop: 2 }}>{user.profile.employee_name}</div>
        </div>

        <div style={{ flex: 1, padding: '12px 10px' }}>
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px',
              background: section === s ? 'rgba(0,153,255,0.1)' : 'transparent',
              border: 'none', borderRadius: 8, fontSize: 13,
              color: section === s ? '#0099ff' : '#7a8aaa',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s', marginBottom: 2,
            }}>
              <span style={{ fontSize: 14 }}>{SECTION_ICONS[s]}</span> {s}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => onNav('chat')} style={{
            width: '100%', padding: '9px 12px',
            background: 'none', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, color: '#7a8aaa', fontSize: 12, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
          }}>
            ← Back to Chat
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {section === 'Add User' && <AddUser showToast={showToast} />}
        {section === 'Upload SOP' && <UploadSOP showToast={showToast} />}
        {section === 'Skills Registry' && <SkillsRegistry showToast={showToast} />}
        {section === 'Assign Skill' && <AssignSkill showToast={showToast} />}
        {section === 'View Tables' && <ViewTables showToast={showToast} />}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
