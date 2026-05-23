// admin.jsx — Russell's admin overlay

const { useState: useAS } = React;

function AdminScreen({ me }) {
  const store = useStore();
  const s = store.state;
  const [sub, setSub] = useAS('approvals'); // approvals | players | game | slices

  const pendingBets = s.bets.filter((b) => b.status === 'pending_approval');
  const pendingSips = s.sipRequests.filter((d) => d.status === 'pending');
  const pendingSignups = s.registrationRequests.filter((r) => r.status === 'pending');
  const liveBets = s.bets.filter((b) => b.status === 'open');

  return (
    <>
      <div className="page-head" style={{ background: 'var(--burgundy)', borderBottom: 0, padding: '14px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFF' }}>
          <Ico.Shield width={20} height={20} />
          <div>
            <div className="subtitle" style={{ color: 'rgba(255,255,255,0.6)' }}>Admin</div>
            <h1 style={{ color: '#FFF', fontSize: 22 }}>Russell's panel</h1>
          </div>
        </div>
        <div style={{
          padding: '4px 10px', background: 'rgba(255,255,255,0.15)',
          borderRadius: 999, color: '#FFF', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        }}>{s.gameStatus.toUpperCase()}</div>
      </div>

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', overflowX: 'auto', padding: '12px 18px 4px', gap: 6,
        background: 'var(--paper-2)', borderBottom: '1px solid var(--line-soft)',
      }}>
        {[
          { id: 'approvals', l: 'Approvals', count: pendingBets.length + pendingSips.length + pendingSignups.length },
          { id: 'players', l: 'Players' },
          { id: 'game', l: 'Game' },
          { id: 'slices', l: 'Wheel' },
        ].map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)}
            style={{
              padding: '8px 14px',
              background: sub === t.id ? 'var(--ink)' : 'transparent',
              color: sub === t.id ? 'var(--paper)' : 'var(--ink-soft)',
              border: 0, borderRadius: 999, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {t.l}
            {t.count != null && t.count > 0 && (
              <span style={{
                background: sub === t.id ? 'var(--gold)' : 'var(--burgundy)',
                color: sub === t.id ? 'var(--ink)' : '#FFF',
                padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {sub === 'approvals' && <AdminApprovals pendingBets={pendingBets} pendingSips={pendingSips} pendingSignups={pendingSignups} liveBets={liveBets} />}
      {sub === 'players' && <AdminPlayers />}
      {sub === 'game' && <AdminGame />}
      {sub === 'slices' && <AdminSlices />}
    </>
  );
}

function AdminApprovals({ pendingBets, pendingSips, pendingSignups, liveBets }) {
  const store = useStore();

  return (
    <div style={{ padding: '12px 18px 24px' }}>
      {/* Sign-up requests — anyone can apply, you approve */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>Sign-ups</div>
      {pendingSignups.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', fontStyle: 'italic', marginBottom: 14 }}>No new sign-ups.</div>
      )}
      <div className="stack-sm" style={{ marginBottom: 18 }}>
        {pendingSignups.map((r) => (
          <div key={r.id} className="card" style={{ padding: 12 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <div className="avatar gold">{r.firstName[0]}{r.lastInitial[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.firstName} {r.lastInitial}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>wants to join the game</div>
                </div>
              </div>
              <div className="num" style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em' }}>
                PIN {r.plainPin || r.pin}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => store.rejectRegistration(r.id)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Decline</button>
              <button onClick={() => store.approveRegistration(r.id)} className="btn btn-gold btn-sm" style={{ flex: 1 }}>Approve</button>
            </div>
          </div>
        ))}
      </div>

      {/* Sip requests */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>Sip requests</div>
      {pendingSips.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', fontStyle: 'italic', marginBottom: 14 }}>None pending.</div>
      )}
      <div className="stack-sm" style={{ marginBottom: 18 }}>
        {pendingSips.map((d) => {
          const p = store.getPlayer(d.playerId);
          return (
            <div key={d.id} className="card" style={{ padding: 12 }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar player={p} size="sm" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p?.firstName} {p?.lastInitial}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>wants to drink {d.amount} sip{d.amount === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 22 }}>+{d.amount}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => store.rejectSipRequest(d.id)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Decline</button>
                <button onClick={() => store.approveSipRequest(d.id)} className="btn btn-gold btn-sm" style={{ flex: 1 }}>Approve</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending bets */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>Bets needing approval</div>
      {pendingBets.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', fontStyle: 'italic', marginBottom: 14 }}>All clear.</div>
      )}
      <div className="stack-sm" style={{ marginBottom: 18 }}>
        {pendingBets.map((b) => {
          const p = store.getPlayer(b.createdBy);
          return (
            <div key={b.id} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                <Avatar player={p} size="sm" />
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{p?.firstName} {p?.lastInitial}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, marginBottom: 10, lineHeight: 1.2 }}>
                "{b.proposition}"
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => store.rejectBet(b.id)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Reject</button>
                <button onClick={() => store.approveBet(b.id)} className="btn btn-gold btn-sm" style={{ flex: 1 }}>Approve</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolve live bets */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>Resolve live bets</div>
      {liveBets.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No live bets.</div>
      )}
      <div className="stack-sm">
        {liveBets.map((b) => (
          <div key={b.id} className="card" style={{ padding: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 6, lineHeight: 1.2 }}>
              "{b.proposition}"
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 10 }}>
              {b.wagers.length} wager{b.wagers.length === 1 ? '' : 's'} · pot: {b.totalFor + b.totalAgainst} sips
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => store.resolveBet({ betId: b.id, outcome: 'against' })} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>NO won</button>
              <button onClick={() => store.resolveBet({ betId: b.id, outcome: 'for' })} className="btn btn-blush btn-sm" style={{ flex: 1 }}>YES won</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPlayers() {
  const store = useStore();
  const players = [...store.state.players].sort((a, b) => b.balance - a.balance);
  const [revealPin, setRevealPin] = useAS(null);

  return (
    <div style={{ padding: '12px 18px 24px' }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="eyebrow">{players.length} players</div>
        <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tap a row to reveal PIN
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {players.map((p, i) => {
          const shown = revealPin === p.id;
          return (
            <div key={p.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                borderBottom: !shown && i === players.length - 1 ? 0 : '1px solid var(--line-soft)',
              }}>
                <Avatar player={p} size="sm" />
                <button
                  onClick={() => setRevealPin(shown ? null : p.id)}
                  style={{
                    flex: 1, fontSize: 14, fontWeight: 500,
                    background: 'transparent', border: 0, padding: 0,
                    textAlign: 'left', cursor: 'pointer', color: 'var(--ink)',
                  }}>
                  {p.firstName} {p.lastInitial}
                  {p.isAdmin && <span className="pill pill-blush" style={{ marginLeft: 8, fontSize: 9 }}>Admin</span>}
                </button>
                <button onClick={() => store.adjustBalance(p.id, -1)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer' }}>−</button>
                <div style={{ minWidth: 36, textAlign: 'center', fontWeight: 700 }} className="num">{p.balance}</div>
                <button onClick={() => store.adjustBalance(p.id, 1)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer' }}>+</button>
              </div>
              {shown && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--gold-faint)',
                  borderBottom: i === players.length - 1 ? 0 : '1px solid var(--line-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold-deep)', fontWeight: 700 }}>
                    PIN
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '0.32em', color: 'var(--ink)' }}>
                    {p.plainPin || p.pin}
                  </div>
                  <button onClick={() => setRevealPin(null)} className="btn btn-quiet btn-sm">Hide</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 12,
        padding: '10px 12px',
        background: 'rgba(180, 98, 107, 0.08)',
        border: '1px dashed var(--blush-rose)',
        borderRadius: 'var(--r-sm)',
        fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.4,
      }}>
        ✨ Players' PINs are visible here so you can read them back to anyone who forgets theirs.
      </div>
    </div>
  );
}

function AdminGame() {
  const store = useStore();
  const s = store.state;
  const [showRestart, setShowRestart] = useAS(false);
  const [broadcastMsg, setBroadcastMsg] = useAS('');
  return (
    <div style={{ padding: '12px 18px 24px' }} className="stack">
      {s.gameStatus === 'waiting' && (
        <div className="card" style={{ padding: 16, background: 'var(--gold-faint)', border: '1px solid var(--gold)' }}>
          <div className="eyebrow gold" style={{ marginBottom: 6 }}>The game hasn't started yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.4 }}>
            Tap below when you're ready. Round 1 will begin, everyone gets +5 sips, and the wheel opens.
          </div>
          <button onClick={() => store.startGame()} className="btn btn-gold btn-block">
            Start the game now
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Game status</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {['waiting', 'active', 'paused', 'ended'].map((st) => (
            <button key={st}
              onClick={() => store.setGameStatus(st)}
              className={`pill ${s.gameStatus === st ? 'pill-ink' : 'pill-line'}`}
              style={{ border: 0, cursor: 'pointer', padding: '6px 12px' }}>
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Round info</div>
        <div className="row between"><span>Current round</span><b className="num">{s.currentRound}</b></div>
        <div className="row between"><span>Next credit drop</span><b className="num">{fmtMSS(store.timeToNextRound())}</b></div>
        <div className="row between"><span>Wheel betting</span><b>{s.rouletteOpen ? `closes in ${fmtMSS(store.timeToSpin())}` : 'closed'}</b></div>
        {!s.rouletteSpinning && !s.rouletteResult && !s.rouletteDisabled && s.gameStatus === 'active' && (
          <button onClick={() => store.spinWheelNow()} className="btn btn-gold btn-block" style={{ marginTop: 10 }}>
            {s.rouletteOpen ? 'Close betting & spin now' : 'Spin the wheel'}
          </button>
        )}
        {s.gameStatus === 'active' && (
          <button onClick={() => store.fastForwardToNextRound()} className="btn btn-ghost btn-block" style={{ marginTop: 6, fontSize: 11 }}>
            Force next round (credit drop + new wheel)
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Broadcast message</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Message to all players…" value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && broadcastMsg.trim()) { store.broadcastMessage(broadcastMsg); setBroadcastMsg(''); } }} />
          <button onClick={() => { if (broadcastMsg.trim()) { store.broadcastMessage(broadcastMsg); setBroadcastMsg(''); } }}
            className="btn btn-gold btn-sm" style={{ whiteSpace: 'nowrap' }}>
            Send
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Roulette wheel</div>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {s.rouletteDisabled ? 'Wheel is disabled — no spins until re-enabled' : 'Wheel is active — spins each round'}
          </div>
          <button onClick={() => store.setRouletteDisabled(!s.rouletteDisabled)}
            className={`btn btn-sm ${s.rouletteDisabled ? 'btn-gold' : 'btn-ghost'}`}
            style={s.rouletteDisabled ? {} : { color: 'var(--burgundy)', borderColor: 'var(--burgundy)' }}>
            {s.rouletteDisabled ? 'Enable' : 'Disable'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 14, border: '1px dashed var(--burgundy)' }}>
        <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--burgundy)' }}>Danger zone</div>
        {!showRestart ? (
          <button onClick={() => setShowRestart(true)} className="btn btn-ghost btn-block"
            style={{ color: 'var(--burgundy)', borderColor: 'var(--burgundy)' }}>
            Restart game
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.4 }}>
              This will reset ALL balances to 0, delete all bets, roulette history, transfers, and activity.
              Players will stay but the game goes back to "waiting". Are you sure?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowRestart(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={() => { store.restartGame(); setShowRestart(false); }}
                className="btn btn-sm btn-block"
                style={{ flex: 1, background: 'var(--burgundy)', color: '#FFF', border: 0 }}>
                Yes, restart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminSlices() {
  const store = useStore();
  const slices = store.state.rouletteSlices;
  const totalWeight = slices.reduce((a, b) => a + b.weight, 0);
  return (
    <div style={{ padding: '12px 18px 24px' }} className="stack-sm">
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="eyebrow">Wheel slices ({slices.length})</div>
        <button onClick={store.addSlice} className="btn btn-ghost btn-sm">
          <Ico.Plus width={14} height={14} /> Add
        </button>
      </div>
      {slices.map((sl) => (
        <div key={sl.id} className="card" style={{ padding: 12 }}>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: sl.color, border: '1px solid rgba(0,0,0,0.1)' }} />
            <input
              value={sl.label}
              onChange={(e) => store.updateSlice(sl.id, { label: e.target.value })}
              className="input"
              style={{ padding: '6px 10px', fontSize: 14, fontWeight: 600 }} />
            <button onClick={() => store.removeSlice(sl.id)}
              style={{ background: 'transparent', border: 0, color: 'var(--ink-mute)', cursor: 'pointer', padding: 4 }}>
              <Ico.X width={16} height={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 4, fontSize: 9 }}>Type</div>
              <select value={sl.type || 'multiplier'}
                onChange={(e) => store.updateSlice(sl.id, { type: e.target.value })}
                className="input" style={{ padding: '6px 8px', fontSize: 12 }}>
                <option value="multiplier">Multiplier</option>
                <option value="dice">Dice</option>
                <option value="mini-game">Mini-game</option>
              </select>
            </div>
            {(sl.type || 'multiplier') === 'multiplier' && (
              <div>
                <div className="field-label" style={{ marginBottom: 4, fontSize: 9 }}>×</div>
                <input type="number" step="0.5" value={sl.multiplier ?? 1}
                  onChange={(e) => store.updateSlice(sl.id, { multiplier: parseFloat(e.target.value) || 0 })}
                  className="input" style={{ padding: '6px 8px', fontSize: 12 }} />
              </div>
            )}
            <div>
              <div className="field-label" style={{ marginBottom: 4, fontSize: 9 }}>Weight</div>
              <input type="number" min="1" value={sl.weight}
                onChange={(e) => store.updateSlice(sl.id, { weight: Math.max(1, parseInt(e.target.value) || 1) })}
                className="input" style={{ padding: '6px 8px', fontSize: 12 }} />
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-mute)' }}>
            {((sl.weight / totalWeight) * 100).toFixed(0)}% chance per spin
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { AdminScreen });
