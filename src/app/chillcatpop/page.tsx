'use client';

import React, { useState, useEffect, useCallback } from 'react';

type GamePhase = 'casual' | 'starting' | 'competitive' | 'ending' | 'summary';

interface Player {
  name: string;
  score: number;
  rank: number;
  skin: string;
  roundScore: number | null;
}

interface RoundSummary {
  total_players: number;
  total_points: number;
  players: { name: string; score: number; skin?: string }[];
  top3: { name: string; score: number; skin?: string }[];
}

interface GameState {
  phase: GamePhase;
  countdown_until: number | null;
  round_id: number;
  last_round_summary: RoundSummary | null;
}

const PHASE_LABEL: Record<GamePhase, string> = {
  casual: 'Casual / Warm-up',
  starting: 'Starting…',
  competitive: '🔴 LIVE',
  ending: 'Ending…',
  summary: 'Round Complete',
};

const PHASE_COLOR: Record<GamePhase, string> = {
  casual: '#64748b',
  starting: '#f59e0b',
  competitive: '#22c55e',
  ending: '#ef4444',
  summary: '#a78bfa',
};

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [gameState, setGameState] = useState<GameState>({ phase: 'casual', countdown_until: null, round_id: 0, last_round_summary: null });
  const [players, setPlayers] = useState<Player[]>([]);
  const [now, setNow] = useState(Date.now());

  const [startDelay, setStartDelay] = useState(5);
  const [endDelay, setEndDelay] = useState(5);
  const [sortBy, setSortBy] = useState<'rank' | 'round'>('rank');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'players' | 'summary'>('players');

  const api = useCallback(async (path: string, opts: any = {}) => {
    const r = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
    if (!r.ok) { const e: any = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
    return r.json();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [stateData, playersData] = await Promise.all([
        api('/api/game-state'),
        api('/api/admin/players'),
      ]);
      setGameState({ phase: stateData.phase || 'casual', countdown_until: stateData.countdown_until, round_id: stateData.round_id || 0, last_round_summary: stateData.last_round_summary || null });
      setPlayers(playersData.players || []);
      setIsLoggedIn(true);
    } catch (e: any) {
      if (e.status === 401) setIsLoggedIn(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
    const t1 = setInterval(refresh, 1000);
    const t2 = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [refresh]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }); setLoginError(false); setPassword(''); await refresh(); }
    catch { setLoginError(true); }
  };

  const startGame = async () => {
    await api('/api/admin/start', { method: 'POST', body: JSON.stringify({ delay_seconds: startDelay }) });
    await refresh();
  };

  const stopGame = async () => {
    await api('/api/admin/stop', { method: 'POST', body: JSON.stringify({ end_delay_seconds: endDelay }) });
    await refresh();
  };

  const resetAll = async () => {
    if (!confirm('Reset ALL scores to 0?')) return;
    await api('/api/admin/reset-all', { method: 'POST' });
    await refresh();
  };

  const playerAction = async (action: 'reset' | 'delete', name: string) => {
    if (action === 'delete' && !confirm(`Delete "${name}"?`)) return;
    await api(`/api/admin/player/${action}`, { method: 'POST', body: JSON.stringify({ username: name }) });
    await refresh();
  };

  const countdown = gameState.countdown_until ? Math.max(0, Math.ceil((gameState.countdown_until - now) / 1000)) : 0;
  const isCountingDown = !!gameState.countdown_until && now < gameState.countdown_until;

  const filteredPlayers = players
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'round') return (b.roundScore ?? b.score) - (a.roundScore ?? a.score);
      return a.rank - b.rank;
    });

  const canStart = gameState.phase === 'casual' || gameState.phase === 'summary';
  const canStop = gameState.phase === 'competitive';

  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0e1a,#0f1829)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 40, width: 360, backdropFilter: 'blur(20px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div>
            <h1 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 800 }}>Admin Panel</h1>
            <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: 14 }}>Popcat Ultra — Operator Access</p>
          </div>
          <form onSubmit={login}>
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} autoFocus
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: `1px solid ${loginError ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, color: '#fff', padding: '14px 16px', fontSize: 16, outline: 'none', marginBottom: 12 }}
            />
            {loginError && <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 12px' }}>❌ Invalid password</p>}
            <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', padding: '14px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              Authorize →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0e1a 0%,#0f1829 50%,#0a0e1a 100%)', fontFamily: 'Inter,system-ui,sans-serif', color: '#e2e8f0', padding: '24px 16px' }}>
      <style>{`
        * { box-sizing: border-box; }
        input, button, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; backdrop-filter: blur(20px); }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
        .btn { border: none; border-radius: 12px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
        .btn-danger { background: linear-gradient(135deg,#ef4444,#dc2626); color: #fff; }
        .btn-ghost { background: rgba(255,255,255,0.07); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
        .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }
        .input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; outline: none; width: 100%; }
        .input:focus { border-color: rgba(99,102,241,0.6); box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        tr:hover td { background: rgba(255,255,255,0.03); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .anim { animation: slideIn 0.3s ease; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 36 }}>🐱</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, background: 'linear-gradient(90deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Popcat Ultra
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Admin Control Panel · Round #{gameState.round_id}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: `${PHASE_COLOR[gameState.phase]}22`, border: `1px solid ${PHASE_COLOR[gameState.phase]}44`, borderRadius: 20, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {gameState.phase === 'competitive' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
              {isCountingDown && <span style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_COLOR[gameState.phase], display: 'inline-block', animation: 'pulse 0.8s infinite' }} />}
              <span style={{ color: PHASE_COLOR[gameState.phase], fontWeight: 700, fontSize: 14 }}>{PHASE_LABEL[gameState.phase]}</span>
              {isCountingDown && <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, minWidth: 30, textAlign: 'center' }}>{countdown}</span>}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '8px 16px', fontSize: 14, color: '#94a3b8' }}>
              👥 {players.length} players
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="card anim" style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Phase Control</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={!canStart} onClick={startGame}>
                🚀 Start Round
              </button>
              <button className="btn btn-danger" disabled={!canStop} onClick={stopGame}>
                🛑 Stop Round
              </button>
              <button className="btn btn-ghost" onClick={resetAll}>
                ⚠️ Reset All
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>Start delay (s)</label>
              <input className="input" type="number" value={startDelay} min={0} max={60} onChange={e => setStartDelay(Number(e.target.value))} style={{ width: 90 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>End delay (s)</label>
              <input className="input" type="number" value={endDelay} min={0} max={60} onChange={e => setEndDelay(Number(e.target.value))} style={{ width: 90 }} />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Total Players', value: players.length, icon: '👤' },
            { label: 'Total Clicks', value: players.reduce((s,p) => s+p.score,0).toLocaleString(), icon: '🖱️' },
            { label: 'Top Score', value: (players[0]?.roundScore ?? players[0]?.score ?? 0).toLocaleString(), icon: '🏆' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 4, width: 'fit-content' }}>
          {(['players','summary'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: tab === t ? 'rgba(99,102,241,0.3)' : 'transparent', color: tab === t ? '#a5b4fc' : '#475569', transition: 'all 0.2s' }}>
              {t === 'players' ? `👥 Players` : `📊 Summary`}
            </button>
          ))}
        </div>

        {/* Players Tab */}
        {tab === 'players' && (
          <div className="card anim">
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input" placeholder="🔍 Search player…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 3 }}>
                {(['rank','round'] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)} style={{ border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: sortBy === s ? 'rgba(99,102,241,0.3)' : 'transparent', color: sortBy === s ? '#a5b4fc' : '#475569', transition: 'all 0.2s' }}>
                    {s === 'rank' ? 'Total' : 'Round'}
                  </button>
                ))}
              </div>
            </div>

            {filteredPlayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div>
                <p style={{ margin: 0, fontSize: 16 }}>No players yet</p>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>Players will appear once they join the game</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {['Rank','Player','Total','This Round','Skin','Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((p, i) => (
                      <tr key={p.name}>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontWeight: 900, fontSize: 16, color: i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#b45309':'#475569' }}>
                            {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${p.rank}`}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 700, color: '#e2e8f0' }}>{p.name}</td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#94a3b8' }}>
                          {(gameState.phase === 'casual' || gameState.phase === 'starting')
                            ? <span style={{ color: '#334155', fontStyle: 'italic' }}>hidden</span>
                            : p.score.toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {p.roundScore !== null
                            ? <span style={{ color: '#4ade80', fontWeight: 700 }}>+{p.roundScore.toLocaleString()}</span>
                            : <span style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#64748b', fontSize: 13 }}>
                          {p.skin === 'default' ? '🐱 Default' : `🎨 #${p.skin}`}
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => playerAction('reset', p.name)}>Reset</button>
                            <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => playerAction('delete', p.name)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Summary Tab */}
        {tab === 'summary' && (
          <div className="anim">
            {!gameState.last_round_summary ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <p style={{ margin: 0, fontSize: 16 }}>No round summary yet</p>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>Complete a round to see results</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 16 }}>
                  {[
                    { label: 'Participants', value: gameState.last_round_summary.total_players },
                    { label: 'Total Clicks', value: gameState.last_round_summary.total_points.toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Top 3 Podium */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>🏆 Top 3 This Round</h3>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {gameState.last_round_summary.top3.map((p, i) => (
                      <div key={p.name} style={{ flex: 1, background: ['rgba(251,191,36,0.08)','rgba(148,163,184,0.08)','rgba(180,83,9,0.08)'][i], border: `1px solid ${['rgba(251,191,36,0.2)','rgba(148,163,184,0.2)','rgba(180,83,9,0.2)'][i]}`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>{['🥇','🥈','🥉'][i]}</div>
                        <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: 18, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ color: ['#fbbf24','#94a3b8','#b45309'][i], fontWeight: 700, fontSize: 22 }}>{p.score.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>clicks this round</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Leaderboard */}
                <div className="card">
                  <h3 style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>All Players</h3>
                  <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {['Rank','Name','Clicks'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gameState.last_round_summary.players.map((p, i) => (
                          <tr key={p.name}>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#475569', fontWeight: 700 }}>#{i+1}</td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 700, color: '#e2e8f0' }}>{p.name}</td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#4ade80', fontWeight: 700 }}>+{p.score.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
