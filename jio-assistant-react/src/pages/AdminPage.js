import React, { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8100';

export default function AdminPage({ user }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [sops, setSops] = useState([]);
  const [skills, setSkills] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    uid: '', emp_code: '', employee_name: '', job_role_code: '', job_role_text: '',
    date_of_joining: '', org_unit: '', job_work_area: '', job_work_stream: '',
    function: '', sub_function: '', company: '', state: '', region: '', facility: '',
    category_l1: '', l1_employee_code: ''
  });

  const [sopForm, setSopForm] = useState({
    doc_name: '', job_role_code: '', job_role_text: '', version: ''
  });

  const [skillForm, setSkillForm] = useState({
    skill_id: '', skill_name: '', proficiency: '', criticality: ''
  });

  const [userSkillForm, setUserSkillForm] = useState({
    uid: '', skill_id: ''
  });

  const [assignForm, setAssignForm] = useState({
    uid: '', job_role_code: '', skill_level: '', proficiency: '', criticality: ''
  });

  // Load data
  useEffect(() => {
    loadUsers();
    loadSops();
    loadSkills();
    loadStats();
    loadUploadedFiles();
  }, []);

  const loadUsers = async () => {
    try {
      const r = await fetch(`${API}/api/users`);
      const data = await r.json();
      if (data.rows) {
        const users = data.rows.map(row => Object.fromEntries(data.columns.map((col, i) => [col, row[i]])));
        setUsers(users);
      }
    } catch (e) { console.log('Error loading users'); }
  };

  const loadSops = async () => {
    try {
      const r = await fetch(`${API}/api/sops`);
      const data = await r.json();
      if (data.rows) {
        const sops = data.rows.map(row => Object.fromEntries(data.columns.map((col, i) => [col, row[i]])));
        setSops(sops);
      }
    } catch (e) { console.log('Error loading SOPs'); }
  };

  const loadSkills = async () => {
    try {
      const r = await fetch(`${API}/api/skills`);
      const data = await r.json();
      if (data.rows) {
        const skills = data.rows.map(row => Object.fromEntries(data.columns.map((col, i) => [col, row[i]])));
        setSkills(skills);
      }
    } catch (e) { console.log('Error loading skills'); }
  };

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/api/stats`);
      const data = await r.json();
      setStats(data);
    } catch (e) { console.log('Error loading stats'); }
  };

  const loadUploadedFiles = async () => {
    try {
      // Get all users first
      const usersList = await (await fetch(`${API}/api/users`)).json();
      if (!usersList.rows) return;

      const allFiles = [];
      for (const userRow of usersList.rows) {
        const uid = userRow[0]; // First column is uid
        const r = await fetch(`${API}/api/user/files/${uid}`);
        const data = await r.json();
        if (data.rows) {
          const files = data.rows.map(row => ({
            ...Object.fromEntries(data.columns.map((col, i) => [col, row[i]])),
            uid: uid
          }));
          allFiles.push(...files);
        }
      }
      setUploadedFiles(allFiles.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date)));
    } catch (e) { console.log('Error loading files'); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => form.append(key, formData[key]));

      const r = await fetch(`${API}/api/user/add`, {
        method: 'POST',
        body: form
      });
      const data = await r.json();
      if (data.message) {
        alert('✓ User added successfully');
        setFormData(Object.keys(formData).reduce((a, k) => ({ ...a, [k]: '' }), {}));
        loadUsers();
      } else {
        alert(`✗ Error: ${data.error}`);
      }
    } catch (e) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const uploadSop = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('sopFile');
    if (!fileInput.files[0]) {
      alert('Please select a file');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('doc_name', sopForm.doc_name);
      form.append('job_role_code', sopForm.job_role_code);
      form.append('job_role_text', sopForm.job_role_text);
      form.append('version', sopForm.version);
      form.append('file', fileInput.files[0]);

      const r = await fetch(`${API}/api/sop/upload`, {
        method: 'POST',
        body: form
      });
      const data = await r.json();
      if (data.message) {
        alert('✓ SOP uploaded: ' + data.message);
        setSopForm({ doc_name: '', job_role_code: '', job_role_text: '', version: '' });
        fileInput.value = '';
        loadSops();
      } else {
        alert(`✗ Error: ${data.error}`);
      }
    } catch (e) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const addSkill = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      Object.keys(skillForm).forEach(key => form.append(key, skillForm[key]));

      const r = await fetch(`${API}/api/skill/add`, {
        method: 'POST',
        body: form
      });
      const data = await r.json();
      if (data.message) {
        alert('✓ Skill added');
        setSkillForm({ skill_id: '', skill_name: '', proficiency: '', criticality: '' });
        loadSkills();
      } else {
        alert(`✗ Error: ${data.error}`);
      }
    } catch (e) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const deleteFile = async (uid, fileName) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      const r = await fetch(`${API}/api/user/delete-file/${uid}/${fileName}`, {
        method: 'DELETE'
      });
      const data = await r.json();
      if (data.message) {
        alert('✓ File deleted');
        loadUploadedFiles();
      } else {
        alert(`✗ Error: ${data.error}`);
      }
    } catch (e) { alert('Error: ' + e.message); }
  };

  const styles = {
    container: {
      padding: '24px', maxWidth: '1400px', margin: '0 auto',
      background: '#04060f', color: '#f0f4ff', minHeight: '100vh', fontFamily: 'DM Sans'
    },
    header: {
      fontSize: '28px', fontWeight: '700', marginBottom: '24px', color: '#f0f4ff',
      fontFamily: 'Syne'
    },
    tabContainer: {
      display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)',
      overflowX: 'auto'
    },
    tabButton: {
      padding: '12px 20px', background: 'transparent', border: 'none', color: '#7a8aaa',
      borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: '14px',
      fontWeight: '500', fontFamily: 'DM Sans',
      transition: 'all 0.2s'
    },
    tabButtonActive: {
      color: '#0099ff', borderBottomColor: '#0099ff'
    },
    section: {
      background: 'rgba(12, 17, 32, 0.5)', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '12px', padding: '20px', marginBottom: '20px'
    },
    sectionTitle: {
      fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#e0e8f8'
    },
    form: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px'
    },
    input: {
      padding: '10px', background: '#0c1120', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', color: '#f0f4ff', fontFamily: 'DM Sans', fontSize: '13px'
    },
    button: {
      padding: '10px 16px', background: '#0099ff', border: 'none', borderRadius: '8px',
      color: '#fff', cursor: 'pointer', fontWeight: '600', fontFamily: 'DM Sans',
      transition: 'background 0.2s', fontSize: '13px'
    },
    table: {
      width: '100%', borderCollapse: 'collapse', fontSize: '12px'
    },
    th: {
      padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)',
      color: '#7a8aaa', fontWeight: '600'
    },
    td: {
      padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e0e8f8'
    },
    statCard: {
      background: 'rgba(0,153,255,0.05)', border: '1px solid rgba(0,153,255,0.2)',
      borderRadius: '8px', padding: '16px', marginBottom: '12px'
    },
    statValue: {
      fontSize: '24px', fontWeight: '700', color: '#0099ff'
    },
    statLabel: {
      fontSize: '12px', color: '#7a8aaa', marginTop: '4px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>⚙️ Admin Panel</div>

      <div style={styles.tabContainer}>
        {['users', 'sops', 'skills', 'files', 'stats'].map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tabButton,
              ...(activeTab === tab ? styles.tabButtonActive : {})
            }}
            onClick={() => { setActiveTab(tab); }}
          >
            {tab === 'users' && '👤 Users'}
            {tab === 'sops' && '📄 SOPs'}
            {tab === 'skills' && '🎯 Skills'}
            {tab === 'files' && '📁 Files'}
            {tab === 'stats' && '📊 Stats'}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Add New User</div>
            <form onSubmit={addUser} style={styles.form}>
              <input placeholder="UID *" value={formData.uid} onChange={e => setFormData({ ...formData, uid: e.target.value })} style={styles.input} required />
              <input placeholder="Employee Code" value={formData.emp_code} onChange={e => setFormData({ ...formData, emp_code: e.target.value })} style={styles.input} />
              <input placeholder="Employee Name *" value={formData.employee_name} onChange={e => setFormData({ ...formData, employee_name: e.target.value })} style={styles.input} required />
              <input placeholder="Job Role Code" value={formData.job_role_code} onChange={e => setFormData({ ...formData, job_role_code: e.target.value })} style={styles.input} />
              <input placeholder="Job Role Text" value={formData.job_role_text} onChange={e => setFormData({ ...formData, job_role_text: e.target.value })} style={styles.input} />
              <input placeholder="Date of Joining" type="date" value={formData.date_of_joining} onChange={e => setFormData({ ...formData, date_of_joining: e.target.value })} style={styles.input} />
              <input placeholder="Organization Unit" value={formData.org_unit} onChange={e => setFormData({ ...formData, org_unit: e.target.value })} style={styles.input} />
              <input placeholder="Work Area" value={formData.job_work_area} onChange={e => setFormData({ ...formData, job_work_area: e.target.value })} style={styles.input} />
              <input placeholder="Work Stream" value={formData.job_work_stream} onChange={e => setFormData({ ...formData, job_work_stream: e.target.value })} style={styles.input} />
              <input placeholder="Function" value={formData.function} onChange={e => setFormData({ ...formData, function: e.target.value })} style={styles.input} />
              <input placeholder="Sub Function" value={formData.sub_function} onChange={e => setFormData({ ...formData, sub_function: e.target.value })} style={styles.input} />
              <input placeholder="Company" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} style={styles.input} />
              <input placeholder="State" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} style={styles.input} />
              <input placeholder="Region" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} style={styles.input} />
              <input placeholder="Facility" value={formData.facility} onChange={e => setFormData({ ...formData, facility: e.target.value })} style={styles.input} />
              <input placeholder="Category L1" value={formData.category_l1} onChange={e => setFormData({ ...formData, category_l1: e.target.value })} style={styles.input} />
              <input placeholder="L1 Employee Code" value={formData.l1_employee_code} onChange={e => setFormData({ ...formData, l1_employee_code: e.target.value })} style={styles.input} />
              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Adding...' : '✓ Add User'}
              </button>
            </form>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>All Users ({users.length})</div>
            {users.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>UID</th>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Job Role</th>
                      <th style={styles.th}>Organization</th>
                      <th style={styles.th}>Facility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{u.uid}</td>
                        <td style={styles.td}>{u.employee_name}</td>
                        <td style={styles.td}>{u.job_role_text}</td>
                        <td style={styles.td}>{u.org_unit_text}</td>
                        <td style={styles.td}>{u.facility}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ color: '#7a8aaa' }}>No users yet</div>}
          </div>
        </>
      )}

      {/* SOPs TAB */}
      {activeTab === 'sops' && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Upload SOP Document</div>
            <form onSubmit={uploadSop} style={styles.form}>
              <input placeholder="Document Name *" value={sopForm.doc_name} onChange={e => setSopForm({ ...sopForm, doc_name: e.target.value })} style={styles.input} required />
              <input placeholder="Job Role Code *" value={sopForm.job_role_code} onChange={e => setSopForm({ ...sopForm, job_role_code: e.target.value })} style={styles.input} required />
              <input placeholder="Job Role Text *" value={sopForm.job_role_text} onChange={e => setSopForm({ ...sopForm, job_role_text: e.target.value })} style={styles.input} required />
              <input placeholder="Version" value={sopForm.version} onChange={e => setSopForm({ ...sopForm, version: e.target.value })} style={styles.input} />
              <input type="file" id="sopFile" accept=".pdf,.docx,.xlsx" style={styles.input} />
              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Uploading...' : '📤 Upload SOP'}
              </button>
            </form>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Available SOPs ({sops.length})</div>
            {sops.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {sops.map((sop, i) => (
                  <div key={i} style={{ background: 'rgba(0,153,255,0.05)', border: '1px solid rgba(0,153,255,0.1)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#0099ff', marginBottom: '6px' }}>📄 {sop.doc_name}</div>
                    <div style={{ fontSize: '11px', color: '#7a8aaa' }}>Role: {sop.job_role_text}</div>
                    <div style={{ fontSize: '11px', color: '#7a8aaa' }}>v{sop.version} · {(sop.file_size / 1024).toFixed(0)}KB</div>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: '#7a8aaa' }}>No SOPs uploaded yet</div>}
          </div>
        </>
      )}

      {/* SKILLS TAB */}
      {activeTab === 'skills' && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Add Skill</div>
            <form onSubmit={addSkill} style={styles.form}>
              <input placeholder="Skill ID *" value={skillForm.skill_id} onChange={e => setSkillForm({ ...skillForm, skill_id: e.target.value })} style={styles.input} required />
              <input placeholder="Skill Name *" value={skillForm.skill_name} onChange={e => setSkillForm({ ...skillForm, skill_name: e.target.value })} style={styles.input} required />
              <select value={skillForm.proficiency} onChange={e => setSkillForm({ ...skillForm, proficiency: e.target.value })} style={styles.input}>
                <option value="">Select Proficiency</option>
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
              </select>
              <select value={skillForm.criticality} onChange={e => setSkillForm({ ...skillForm, criticality: e.target.value })} style={styles.input}>
                <option value="">Select Criticality</option>
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
              </select>
              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Adding...' : '✓ Add Skill'}
              </button>
            </form>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Available Skills ({skills.length})</div>
            {skills.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                {skills.map((skill, i) => (
                  <div key={i} style={{ background: 'rgba(0,200,100,0.05)', border: '1px solid rgba(0,200,100,0.1)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#00d68f', marginBottom: '4px' }}>🎯 {skill.skill_name}</div>
                    <div style={{ fontSize: '11px', color: '#7a8aaa' }}>Proficiency: {skill.proficiency}</div>
                    <div style={{ fontSize: '11px', color: '#7a8aaa' }}>Criticality: {skill.criticality}</div>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: '#7a8aaa' }}>No skills defined yet</div>}
          </div>
        </>
      )}

      {/* FILES TAB (NEW) */}
      {activeTab === 'files' && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📁 User File Uploads ({uploadedFiles.length})</div>
            {uploadedFiles.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>User ID</th>
                      <th style={styles.th}>File Name</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Size</th>
                      <th style={styles.th}>Uploaded</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles.slice(0, 50).map((f, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{f.uid}</td>
                        <td style={{ ...styles.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file_name}</td>
                        <td style={styles.td}>{f.file_type?.toUpperCase()}</td>
                        <td style={styles.td}>{(f.file_size / 1024).toFixed(1)}KB</td>
                        <td style={styles.td}>{new Date(f.upload_date).toLocaleDateString()}</td>
                        <td style={styles.td}>
                          <button onClick={() => deleteFile(f.uid, f.file_name)} style={{
                            background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)',
                            color: '#ff4d6d', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                            fontSize: '11px', fontFamily: 'DM Sans'
                          }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ color: '#7a8aaa' }}>No files uploaded yet</div>}
          </div>
        </>
      )}

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>System Statistics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_users || 0}</div>
              <div style={styles.statLabel}>Total Users</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_sops || 0}</div>
              <div style={styles.statLabel}>SOP Documents</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_skills || 0}</div>
              <div style={styles.statLabel}>Skills Defined</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_files || 0}</div>
              <div style={styles.statLabel}>User Files Uploaded</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_user_uploads || 0}</div>
              <div style={styles.statLabel}>Documents</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.total_snapshots || 0}</div>
              <div style={styles.statLabel}>Snapshots</div>
            </div>
            <div style={{ ...styles.statCard, background: 'rgba(255,181,71,0.05)', borderColor: 'rgba(255,181,71,0.2)' }}>
              <div style={{ ...styles.statValue, color: '#ffb547' }}>{(stats.total_storage_gb || 0).toFixed(2)}GB</div>
              <div style={styles.statLabel}>Total Storage Used</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
