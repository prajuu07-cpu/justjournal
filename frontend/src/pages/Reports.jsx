import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatDate } from '../utils/dateHelper';
import DailyPnLCalendar from '../components/DailyPnLCalendar';
import { useMode } from '../context/ModeContext';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const _cy = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => _cy - i);

function StatBadge({ label, value, cls='' }) {
  return (
    <div className="rpt-stat">
      <div className="rpt-sl">{label}</div>
      <div className={`rpt-sv ${cls}`}>{value != null ? value : '—'}</div>
    </div>
  );
}

function ModelStatBadge({ model }) {
  const accentColor = model.color?.text || 'var(--indigo)';
  const bgColor = model.color?.bg || 'transparent';

  // Determine RR color from value string (e.g. "+4.0R", "-3.0R", "0.0R")
  const rrNum = parseFloat(model.rr);
  const rrColor = isNaN(rrNum) ? 'inherit' : rrNum > 0 ? 'var(--green, #16a34a)' : rrNum < 0 ? 'var(--red, #dc2626)' : 'inherit';

  return (
    <div className="rpt-stat" style={{ borderLeft: `4px solid ${accentColor}`, backgroundColor: bgColor }}>
      <div className="rpt-sl" style={{ color: accentColor, fontSize: '12px', marginBottom: '10px', borderBottom: `1px solid ${model.color ? 'rgba(0,0,0,0.05)' : 'var(--faint)'}`, paddingBottom: '4px' }}>
        {model.name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Trades</div>
          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{model.trades}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate</div>
          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'JetBrains Mono' }} className={model.winRate >= 50 ? 'rp' : model.winRate < 50 ? 'rn' : ''}>
            {model.winRate}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Net PnL</div>
          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'JetBrains Mono' }} className={model.netPNL > 0 ? 'rp' : model.netPNL < 0 ? 'rn' : ''}>
            {model.netPNL >= 0 ? '+' : ''}{model.netPNL}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>RR</div>
          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: rrColor }}>
            {model.rr}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonthlyReports() {
  const { mode } = useMode();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true); setErr('');
    api.get(`/trades/month/${year}/${month}`, { params: { mode } })
      .then(r => setData(r.data))
      .catch(e => setErr(e.message||'Failed to load'))
      .finally(() => setLoading(false));
  }, [year, month, mode]);

  const exportPDF = async () => {
    setExporting(true); setErr('');
    try {
      const url = `/api/export/month/${year}/${month}?mode=${localStorage.getItem('tjp_active_mode') || 'justchill'}`;
      const res = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('tjp_token')}`,
          'X-Mode': localStorage.getItem('tjp_active_mode') || 'justchill'
        } 
      });
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
        <div className="header-btns">
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
            <StatBadge label="Win Rate" value={`${data.stats.winRate}%`} cls={data.stats.winRate >= 50 ? 'rp' : data.stats.winRate < 50 ? 'rn' : ''}/>
            <StatBadge label="Net PNL" value={`${data.stats.netPNL>=0?'+':''}${data.stats.netPNL}%`} cls={data.stats.netPNL > 0 ? 'rp' : data.stats.netPNL < 0 ? 'rn' : ''}/>
            <StatBadge label="Overall RR" value={data.stats.overallRR} cls="svB"/>
            <StatBadge label="Max Loss Streak" value={data.stats.maxLossStreak} cls="rn"/>
            
            {data.stats.modelStats && data.stats.modelStats.map(m => (
              <ModelStatBadge key={m.name} model={m} />
            ))}
          </div>

          <DailyPnLCalendar
            year={year}
            month={month}
            dailyBreakdown={data.stats.dailyBreakdown || {}}
          />

          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Pair</th>{mode === 'practice' && <th>Session</th>}<th>Model</th>{mode !== 'practice' && <th>Grade</th>}<th>Dir</th><th>Risk</th><th>Result</th><th style={{textAlign:'center'}}>R:R</th><th>PNL</th></tr></thead>
                <tbody>
                  {data.trades.map(t=>(
                    <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                      <td>{formatDate(t.date)}</td>
                      <td><strong>{t.pair}</strong></td>
                      {mode === 'practice' && <td>{t.session || '—'}</td>}
                      <td>
                        <span 
                          className={`pill ${
                            t.model === 'Practice' || t.model === 'Practice Model' ? 'pPM' :
                            t.model === 'Model 2' ? 'pM2' :
                            t.model?.toLowerCase() === 'model 3' ? 'pM3' : 'pM1'
                          }`}
                          style={
                            t.model === 'Practice' || t.model === 'Practice Model' ? {} :
                            t.model_color ? {
                              backgroundColor: t.model_color.bg,
                              color: t.model_color.text,
                              borderColor: t.model_color.border,
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            } : (t.model?.toLowerCase() === 'model 3' ? {
                              backgroundColor: '#FDF2F8',
                              color: '#DB2777',
                              borderColor: '#FCE7F3',
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            } : {})
                          }
                        >
                          {t.model === 'Practice Model' ? 'Practice' : t.model}
                        </span>
                      </td>
                      {mode !== 'practice' && <td><span className={`pill ${t.grade==='A+'?'pAp':t.grade==='A'?'pA':t.grade==='B'?'pB':t.grade==='C'?'pC':'pLow'}`}>{t.grade}</span></td>}
                      <td>{t.direction}</td><td>{t.risk_percent}%</td>
                      <td>{t.result?<span className={`pill ${t.result==='Win'?'pWin':t.result==='Loss'?'pLoss':'pBE'}`}>{t.result}</span>:'—'}</td>
                      <td style={{textAlign:'center'}} className="mono">{t.r_multiple != null ? (parseFloat(t.r_multiple) === 0 ? '0:00R' : `${parseFloat(t.r_multiple) > 0 ? '+' : ''}${parseFloat(t.r_multiple).toFixed(2)}R`) : '—'}</td>
                      <td className={t.pnl_percentage>0?'rp':t.pnl_percentage<0?'rn':'mono'}>{t.pnl_percentage!=null?`${t.pnl_percentage>=0?'+':''}${parseFloat(t.pnl_percentage).toFixed(2)}%`:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function YearlyReports() {
  const { mode } = useMode();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true); setErr('');
    api.get(`/trades/year/${year}`, { params: { mode } })
      .then(r => setData(r.data))
      .catch(e => setErr(e.message||'Failed to load'))
      .finally(() => setLoading(false));
  }, [year, mode]);

  const exportPDF = async () => {
    setExporting(true); setErr('');
    try {
      const url = `/api/export/year/${year}?mode=${localStorage.getItem('tjp_active_mode') || 'justchill'}`;
      const res = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('tjp_token')}`,
          'X-Mode': localStorage.getItem('tjp_active_mode') || 'justchill'
        } 
      });
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
        <div className="header-btns">
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
            <StatBadge label="Win Rate" value={`${data.stats.winRate}%`} cls={data.stats.winRate >= 50 ? 'rp' : data.stats.winRate < 50 ? 'rn' : ''}/>
            <StatBadge label="Net PNL" value={`${data.stats.netPNL>=0?'+':''}${data.stats.netPNL}%`} cls={data.stats.netPNL > 0 ? 'rp' : data.stats.netPNL < 0 ? 'rn' : ''}/>
            <StatBadge label="Overall RR" value={data.stats.overallRR} cls="svB"/>
            <StatBadge label="Best Month" value={data.stats.bestMonth ? `${MONTHS[data.stats.bestMonth.month-1]} (${data.stats.bestMonth.pnl >= 0 ? '+' : ''}${data.stats.bestMonth.pnl}%)` : '—'} cls={data.stats.bestMonth && data.stats.bestMonth.pnl > 0 ? 'rp' : ''}/>
            <StatBadge label="Worst Month" value={data.stats.worstMonth ? `${MONTHS[data.stats.worstMonth.month-1]} (${data.stats.worstMonth.pnl >= 0 ? '+' : ''}${data.stats.worstMonth.pnl}%)` : '—'} cls={data.stats.worstMonth && data.stats.worstMonth.pnl < 0 ? 'rn' : ''}/>
            
            {data.stats.modelStats && data.stats.modelStats.map(m => (
              <ModelStatBadge key={m.name} model={m} />
            ))}
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
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Pair</th>{mode === 'practice' && <th>Session</th>}<th>Model</th>{mode !== 'practice' && <th>Grade</th>}<th>Dir</th><th>Risk</th><th>Result</th><th style={{textAlign:'center'}}>R:R</th><th>PNL</th></tr></thead>
                <tbody>
                  {data.trades.map(t=>(
                    <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                      <td>{formatDate(t.date)}</td><td><strong>{t.pair}</strong></td>
                      {mode === 'practice' && <td>{t.session || '—'}</td>}
                      <td>
                        <span 
                          className={`pill ${
                            t.model === 'Practice' || t.model === 'Practice Model' ? 'pPM' :
                            t.model === 'Model 2' ? 'pM2' :
                            t.model?.toLowerCase() === 'model 3' ? 'pM3' : 'pM1'
                          }`}
                          style={
                            t.model === 'Practice' || t.model === 'Practice Model' ? {} :
                            t.model_color ? {
                              backgroundColor: t.model_color.bg,
                              color: t.model_color.text,
                              borderColor: t.model_color.border,
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            } : (t.model?.toLowerCase() === 'model 3' ? {
                              backgroundColor: '#FDF2F8',
                              color: '#DB2777',
                              borderColor: '#FCE7F3',
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            } : {})
                          }
                        >
                          {t.model === 'Practice Model' ? 'Practice' : t.model}
                        </span>
                      </td>
                      {mode !== 'practice' && <td><span className={`pill ${t.grade==='A+'?'pAp':t.grade==='A'?'pA':t.grade==='B'?'pB':t.grade==='C'?'pC':'pLow'}`}>{t.grade}</span></td>}
                      <td>{t.direction}</td><td>{t.risk_percent}%</td>
                      <td>{t.result?<span className={`pill ${t.result==='Win'?'pWin':t.result==='Loss'?'pLoss':'pBE'}`}>{t.result}</span>:'—'}</td>
                      <td style={{textAlign:'center'}} className="mono">{t.r_multiple != null ? (parseFloat(t.r_multiple) === 0 ? '0:00R' : `${parseFloat(t.r_multiple) > 0 ? '+' : ''}${parseFloat(t.r_multiple).toFixed(2)}R`) : '—'}</td>
                      <td className={t.pnl_percentage>0?'rp':t.pnl_percentage<0?'rn':'mono'}>{t.pnl_percentage!=null?`${t.pnl_percentage>=0?'+':''}${parseFloat(t.pnl_percentage).toFixed(2)}%`:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
