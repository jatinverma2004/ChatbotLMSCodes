import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';

const API = 'http://127.0.0.1:8100';
const DB_API = 'http://127.0.0.1:9000';

function KPICard({ label, value, color = '#0099ff', suffix = '' }) {
  return (
    <div style={{
      background: '#0c1120', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, color }}>
        {value}{suffix}
      </div>
    </div>
  );
}

function GaugeChart({ score }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 85 ? '#00d68f' : score >= 70 ? '#0099ff' : score >= 50 ? '#ffb547' : '#ff4d6d';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 16px' }}>
      <svg width={200} height={120} viewBox="0 0 200 120">
        {/* Track */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} strokeLinecap="round" />
        {/* Zones */}
        {[
          ['#8B0000', 0, 50], ['#ffb547', 50, 70], ['#0099ff', 70, 85], ['#00d68f', 85, 100]
        ].map(([c, from, to]) => {
          const a1 = -135 + (from / 100) * 270;
          const a2 = -135 + (to / 100) * 270;
          const toRad = a => (a * Math.PI) / 180;
          const x1 = 100 + 80 * Math.cos(toRad(a1));
          const y1 = 100 + 80 * Math.sin(toRad(a1));
          const x2 = 100 + 80 * Math.cos(toRad(a2));
          const y2 = 100 + 80 * Math.sin(toRad(a2));
          const large = (a2 - a1) > 180 ? 1 : 0;
          return (
            <path key={c} d={`M ${x1} ${y1} A 80 80 0 ${large} 1 ${x2} ${y2}`}
              fill="none" stroke={c} strokeWidth={14} strokeLinecap="round" opacity={0.3} />
          );
        })}
        {/* Needle */}
        {(() => {
          const toRad = a => (a * Math.PI) / 180;
          const nx = 100 + 68 * Math.cos(toRad(angle));
          const ny = 100 + 68 * Math.sin(toRad(angle));
          return (
            <>
              <line x1={100} y1={100} x2={nx} y2={ny} stroke={color} strokeWidth={3} strokeLinecap="round" />
              <circle cx={100} cy={100} r={6} fill={color} />
            </>
          );
        })()}
      </svg>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 700, color, marginTop: -8 }}>
        {score.toFixed(1)}
      </div>
      <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 4 }}>AI System Health</div>
    </div>
  );
}

const VERDICT_COLORS = { Excellent: '#00d68f', Good: '#0099ff', Average: '#ffb547', Poor: '#ff4d6d', Unknown: '#7a8aaa' };

export default function DashboardPage({ user, onNav }) {
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('');
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    // Try to fetch from a dashboard endpoint; fallback to empty
    fetch(`${DB_API}/dashboard/data`).then(r => r.json()).then(setEvals).catch(() => setEvals([])).finally(() => setLoading(false));
  }, []);

  const validEvals = evals.filter(e => e.accuracy > 0);
  const avg = key => validEvals.length ? validEvals.reduce((a, b) => a + (b[key] || 0), 0) / validEvals.length : 0;

  const avgAcc = avg('accuracy');
  const avgPrec = avg('precision');
  const avgRec = avg('recall');
  const score = (avgAcc + avgPrec + avgRec) / 3 * 100;

  // Verdict distribution
  const verdictCounts = validEvals.reduce((acc, e) => {
    acc[e.verdict] = (acc[e.verdict] || 0) + 1;
    return acc;
  }, {});
  const verdictData = Object.entries(verdictCounts).map(([name, value]) => ({ name, value }));

  // Trend data (group by ~10 min)
  const trendData = validEvals.slice(-50).map((e, i) => ({
    idx: i,
    accuracy: parseFloat((e.accuracy || 0).toFixed(2)),
    time: e.created_at ? new Date(e.created_at).toLocaleTimeString() : '',
  }));

  // Failures
  const failures = validEvals.filter(e => e.accuracy < 0.6).slice(0, 5);

  // Top queries
  const qCounts = validEvals.reduce((acc, e) => {
    if (e.question) acc[e.question] = (acc[e.question] || 0) + 1;
    return acc;
  }, {});
  const topQueries = Object.entries(qCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  function generateReport() {
    const best = [...validEvals].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
    const worst = [...validEvals].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
    setReport(`AI PERFORMANCE REPORT
========================

OVERVIEW
Total Queries: ${validEvals.length}

METRICS
Accuracy   : ${avgAcc.toFixed(2)}
Relevance  : ${avgPrec.toFixed(2)}
Grounding  : ${avgRec.toFixed(2)}
Health Score: ${score.toFixed(1)}/100

TOP PERFORMING QUERIES
${best.map(e => `• ${e.question?.slice(0, 60)} (${e.accuracy?.toFixed(2)})`).join('\n')}

WORST PERFORMING QUERIES
${worst.map(e => `• ${e.question?.slice(0, 60)} (${e.accuracy?.toFixed(2)})`).join('\n')}

RECOMMENDATIONS
- Improve SOP indexing for low-accuracy queries
- Add more structured SOP content
- Enhance retrieval logic for poor-scoring topics
`);
    setShowReport(true);
  }

  const Section = ({ title, children }) => (
    <div style={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#f0f4ff', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#04060f', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 200, minWidth: 200, background: '#070c18',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', padding: 16,
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>
          Dashboard
        </div>
        <div style={{ fontSize: 11, color: '#7a8aaa', marginBottom: 20 }}>AI Performance</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => onNav('chat')} style={{
          width: '100%', padding: '9px 12px',
          background: 'none', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, color: '#7a8aaa', fontSize: 12, cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
        }}>← Chat</button>
        <button onClick={() => onNav('admin')} style={{
          width: '100%', padding: '9px 12px',
          background: 'none', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, color: '#7a8aaa', fontSize: 12, cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
        }}>⚙ Admin</button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f0f4ff' }}>
              AI Performance Dashboard
            </h1>
            <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 2 }}>
              {validEvals.length} evaluated queries
            </div>
          </div>
          <button onClick={generateReport} style={{
            padding: '9px 18px', background: 'rgba(0,153,255,0.1)',
            border: '1px solid rgba(0,153,255,0.3)', borderRadius: 9,
            color: '#0099ff', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}>
            Generate Report
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#7a8aaa', padding: 60 }}>Loading evaluation data...</div>
        ) : validEvals.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#7a8aaa', padding: 60,
            background: '#0c1120', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, color: '#f0f4ff', marginBottom: 8 }}>No evaluation data yet</div>
            <div style={{ fontSize: 12 }}>Chat with the assistant to generate performance metrics</div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <KPICard label="Accuracy" value={avgAcc.toFixed(2)} color="#0099ff" />
              <KPICard label="Relevance" value={avgPrec.toFixed(2)} color="#00d68f" />
              <KPICard label="Grounding" value={avgRec.toFixed(2)} color="#ffb547" />
              <KPICard label="Total Queries" value={validEvals.length} color="#f0f4ff" />
            </div>

            {/* Gauge + Verdicts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <Section title="System Health">
                <GaugeChart score={score} />
              </Section>
              <Section title="Verdict Distribution">
                {verdictData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={verdictData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#7a8aaa', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#7a8aaa', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f4ff' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {verdictData.map((entry, i) => (
                          <Cell key={i} fill={VERDICT_COLORS[entry.name] || '#0099ff'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: '#7a8aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>No verdicts yet</div>}
              </Section>
            </div>

            {/* Accuracy Trend */}
            {trendData.length > 1 && (
              <Section title="Accuracy Trend">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fill: '#7a8aaa', fontSize: 10 }} />
                    <YAxis domain={[0, 1]} tick={{ fill: '#7a8aaa', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0c1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f4ff' }} />
                    <Line type="monotone" dataKey="accuracy" stroke="#0099ff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Section>
            )}

            {/* Failures + Top Queries */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Section title="⚠ Failure Analysis">
                {failures.length === 0
                  ? <div style={{ color: '#7a8aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>No failures — great job!</div>
                  : failures.map((e, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', background: 'rgba(255,77,109,0.06)',
                      border: '1px solid rgba(255,77,109,0.15)', borderRadius: 8, marginBottom: 8,
                    }}>
                      <div style={{ fontSize: 12, color: '#f0f4ff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.question}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                        <span style={{ color: '#ff4d6d' }}>acc: {e.accuracy?.toFixed(2)}</span>
                        <span style={{ color: '#7a8aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.reason}</span>
                      </div>
                    </div>
                  ))
                }
              </Section>

              <Section title="🔥 Top Queries">
                {topQueries.length === 0
                  ? <div style={{ color: '#7a8aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>No data yet</div>
                  : topQueries.map(([q, count], i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ fontSize: 12, color: '#c0ccdd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>
                        {q}
                      </div>
                      <div style={{
                        fontSize: 11, background: 'rgba(0,153,255,0.1)', color: '#0099ff',
                        padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                      }}>{count}×</div>
                    </div>
                  ))
                }
              </Section>
            </div>
          </>
        )}

        {/* Report modal */}
        {showReport && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }} onClick={() => setShowReport(false)}>
            <div style={{
              background: '#0c1120', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 28, maxWidth: 560, width: '90%', maxHeight: '80vh', overflow: 'auto',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 600, color: '#f0f4ff' }}>AI Executive Report</div>
                <button onClick={() => setShowReport(false)} style={{ background: 'none', border: 'none', color: '#7a8aaa', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <pre style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c0ccdd', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {report}
              </pre>
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button onClick={() => {
                  const blob = new Blob([report], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'ai_report.txt'; a.click();
                }} style={{
                  padding: '8px 16px', background: '#0099ff', border: 'none',
                  borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}>⬇ Download</button>
                <button onClick={() => setShowReport(false)} style={{
                  padding: '8px 16px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#7a8aaa', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
