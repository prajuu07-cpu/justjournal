import { useEffect, useState } from 'react';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '../utils/dateHelper';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = [2024, 2025, 2026, 2027];

function StatBadge({ label, value, cls='' }) {
  return (
    <div className="rpt-stat">
      <div className="rpt-sl">{label}</div>
      <div className={`rpt-sv ${cls}`}>{value != null ? value : '—'}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{background:'#fff',border:'1px solid #E2E8F0',padding:'8px 12px',borderRadius:'8px',boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}}>
        <p style={{margin:0,fontSize:12,fontWeight:600,color:'#64748B'}}>{`Trade ${label}`}</p>
        <p style={{margin:0,fontSize:14,fontWeight:700,color:'#2563EB'}}>{`${payload[0].value}% Equity`}</p>
      </div>
    );
  }
  return null;
}

export function MonthlyReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true); setErr('');
    api.get(`/trades/month/${year}/${month}`)
      .then(r => setData(r.data))
      .catch(e => setErr(e.message||'Failed to load'))
      .finally(() => setLoading(false));
  }, [year, month]);

  const exportPDF = async () => {
    setExporting(true); setErr('');
    try {
      const url = `/api/export/month/${year}/${month}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('tjp_token')}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = `monthly-report-${year}-${month}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objUrl);
    } catch(ex) { setErr('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Monthly Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportPDF} disabled={exporting}>
            {exporting ? 'Exporting…' : '⬇ Export PDF'}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select className="fsel" value={year} onChange={e=>setYear(Number(e.target.value))}>
          {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8,flex:1}}>
          {MONTHS.map((m,i)=>{
            const isSel = month === (i+1);
            return <button key={m} className={`btn btn-sm ${isSel?'btn-primary':'btn-ghost'}`} onClick={()=>setMonth(i+1)}>{m}</button>;
          })}
        </div>
      </div>

      {err && <div className="err-box">{err}</div>}
      {loading ? <div className="loading">Loading…</div> : !data || data.trades.length===0 ? <div className="empty">No trades found for {MONTHS[month-1]} {year}.</div> : (
        <>
          <div className="sg">
            <StatBadge label="Total Trades" value={data.stats.totalTrades}/>
            <StatBadge label="Wins" value={data.stats.wins} cls="rp"/>
            <StatBadge label="Losses" value={data.stats.losses} cls="rn"/>
            <StatBadge label="Win Rate" value={`${data.stats.winRate}%`} cls={data.stats.winRate > 50 ? 'rp' : data.stats.winRate < 50 ? 'rn' : ''}/>
            <StatBadge label="Net PNL" value={`${data.stats.netPNL>=0?'+':''}${data.stats.netPNL}%`} cls={data.stats.netPNL > 0 ? 'rp' : data.stats.netPNL < 0 ? 'rn' : ''}/>
            <StatBadge label="Max Loss Streak" value={data.stats.maxLossStreak} cls="rn"/>
          </div>

          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Pair</th><th>Grade</th><th>Dir</th><th>Risk</th><th>Result</th><th>R:R</th><th>PNL</th></tr></thead>
              <tbody>
                {data.trades.map(t=>(
                  <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                    <td>{formatDate(t.date)}</td><td><strong>{t.pair}</strong></td>
                    <td><span className={`pill ${t.grade==='A+'?'pAp':t.grade==='A'?'pB':'pLow'}`}>{t.grade}</span></td>
                    <td>{t.direction}</td><td>{t.risk_percent}%</td>
                    
                    <td>{t.result?<span className={`pill ${t.result==='Win'?'pWin':t.result==='Loss'?'pLoss':'pBE'}`}>{t.result}</span>:'—'}</td>
                    <td className="mono">{t.r_multiple?`${parseFloat(t.r_multiple).toFixed(2)}R`:'—'}</td>
                    <td className={t.pnl_percentage>0?'rp':t.pnl_percentage<0?'rn':'mono'}>{t.pnl_percentage!=null?`${t.pnl_percentage>=0?'+':''}${parseFloat(t.pnl_percentage).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function YearlyReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true); setErr('');
    api.get(`/trades/year/${year}`)
      .then(r => setData(r.data))
      .catch(e => setErr(e.message||'Failed to load'))
      .finally(() => setLoading(false));
  }, [year]);

  const exportPDF = async () => {
    setExporting(true); setErr('');
    try {
      const url = `/api/export/year/${year}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('tjp_token')}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = `yearly-report-${year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objUrl);
    } catch(ex) { setErr('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Yearly Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportPDF} disabled={exporting}>
            {exporting ? 'Exporting…' : '⬇ Export PDF'}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select className="fsel" value={year} onChange={e=>setYear(Number(e.target.value))}>
          {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {err && <div className="err-box">{err}</div>}
      {loading ? <div className="loading">Loading…</div> : !data || data.trades.length===0 ? <div className="empty">No trades found for {year}.</div> : (
        <>
          <div className="sg">
            <StatBadge label="Total Trades" value={data.stats.totalTrades}/>
            <StatBadge label="Wins" value={data.stats.wins} cls="rp"/>
            <StatBadge label="Losses" value={data.stats.losses} cls="rn"/>
            <StatBadge label="Win Rate" value={`${data.stats.winRate}%`} cls={data.stats.winRate > 50 ? 'rp' : data.stats.winRate < 50 ? 'rn' : ''}/>
            <StatBadge label="Net PNL" value={`${data.stats.netPNL>=0?'+':''}${data.stats.netPNL}%`} cls={data.stats.netPNL > 0 ? 'rp' : data.stats.netPNL < 0 ? 'rn' : ''}/>
            <StatBadge label="Best Month" value={data.stats.bestMonth ? `${MONTHS[data.stats.bestMonth.month-1]} (${data.stats.bestMonth.pnl >= 0 ? '+' : ''}${data.stats.bestMonth.pnl}%)` : '—'} cls={data.stats.bestMonth && data.stats.bestMonth.pnl > 0 ? 'rp' : ''}/>
            <StatBadge label="Worst Month" value={data.stats.worstMonth ? `${MONTHS[data.stats.worstMonth.month-1]} (${data.stats.worstMonth.pnl >= 0 ? '+' : ''}${data.stats.worstMonth.pnl}%)` : '—'} cls={data.stats.worstMonth && data.stats.worstMonth.pnl < 0 ? 'rn' : ''}/>
          </div>

          <div className="card" style={{padding:24}}>
            <div className="card-title">Monthly PNL Breakdown ({year})</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(80px,1fr))',gap:12}}>
              {data.stats.monthlyBreakdown.map(m=>(
                <div key={m.month} style={{textAlign:'center',padding:'12px 8px',borderRadius:12,backgroundColor:'#F8FAFC',border:'1px solid #E2E8F0'}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#64748B',marginBottom:4}}>{MONTHS[m.month-1]}</div>
                  <div style={{fontSize:14,fontWeight:800,fontFamily:'JetBrains Mono'}} className={m.pnl>0?'rp':m.pnl<0?'rn':''}>
                    {m.pnl>0?'+':''}{m.pnl}%
                  </div>
                </div>
              ))}
            </div>
          </div>


          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Pair</th><th>Grade</th><th>Dir</th><th>Risk</th><th>Result</th><th>R:R</th><th>PNL</th></tr></thead>
              <tbody>
                {data.trades.map(t=>(
                  <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                    <td>{formatDate(t.date)}</td><td><strong>{t.pair}</strong></td>
                    <td><span className={`pill ${t.grade==='A+'?'pAp':t.grade==='A'?'pB':'pLow'}`}>{t.grade}</span></td>
                    <td>{t.direction}</td><td>{t.risk_percent}%</td>
                    
                    <td>{t.result?<span className={`pill ${t.result==='Win'?'pWin':t.result==='Loss'?'pLoss':'pBE'}`}>{t.result}</span>:'—'}</td>
                    <td className="mono">{t.r_multiple?`${parseFloat(t.r_multiple).toFixed(2)}R`:'—'}</td>
                    <td className={t.pnl_percentage>0?'rp':t.pnl_percentage<0?'rn':'mono'}>{t.pnl_percentage!=null?`${t.pnl_percentage>=0?'+':''}${parseFloat(t.pnl_percentage).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
