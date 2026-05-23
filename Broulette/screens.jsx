// screens.jsx — Login + Dashboard + Bets + Send + Activity + Leaderboard

const { useState: useS, useEffect: useE, useMemo: useM, useRef: useR } = React;

// ────────────────────────────────────────────────────────────
// LOGIN / REGISTER
// ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, frameId }) {
  const store = useStore();
  const [mode, setMode] = useS('login'); // login | register
  const [firstName, setFn] = useS('');
  const [lastInitial, setLi] = useS('');
  const [pin, setPin] = useS('');
  const [err, setErr] = useS('');
  const [pendingReqId, setPendingReqId] = useS(null);

  // Default fill different per frame for demo (login mode only —
  // in register mode the player enters their own name + PIN).
  useE(() => {
    if (mode !== 'login') return;
    if (frameId === 'ios') { setFn('Russell'); setLi('W'); setPin('787789'); }
    else { setFn('Izzy'); setLi('M'); setPin('052326'); }
  }, [frameId, mode]);

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setErr('');
    if (m === 'register') {
      // Clear the demo pre-fill so the player picks their own name + PIN
      setFn(''); setLi(''); setPin('');
    }
  };

  // Watch for Russell to approve/reject our pending sign-up
  useE(() => {
    if (!pendingReqId) return;
    const req = store.state.registrationRequests.find((r) => r.id === pendingReqId);
    if (!req) return;
    if (req.status === 'approved') {
      const p = req.playerId ? store.getPlayer(req.playerId) : store.findPlayerByName(req.firstName, req.lastInitial);
      if (p) onLogin(p);
    } else if (req.status === 'rejected') {
      setErr("Russell didn't approve you. Try again or grab him.");
      setPendingReqId(null);
    }
  });

  const submit = async () => {
    setErr('');
    if (!firstName.trim() || !lastInitial.trim() || pin.length !== 6) {
      setErr('Fill in your name and a 6-digit PIN');
      return;
    }
    if (mode === 'login') {
      const p = await store.tryLogin({ firstName: firstName.trim(), lastInitial: lastInitial.trim(), pin });
      if (p) onLogin(p);
      else setErr("No match. Check your name and PIN, or sign up.");
    } else {
      const r = await store.requestRegistration({ firstName: firstName.trim(), lastInitial: lastInitial.trim(), pin });
      if (r.error) { setErr(r.error); return; }
      setPendingReqId(r.request.id);
    }
  };

  // PENDING APPROVAL VIEW ----------------------------------------
  if (pendingReqId) {
    const req = store.state.registrationRequests.find((r) => r.id === pendingReqId);
    return (
      <div className="app" style={{
        background: `radial-gradient(120% 80% at 50% 0%, var(--blush-soft) 0%, var(--bg) 55%)`,
      }}>
        <div className="app-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '64px 32px 24px', textAlign: 'center' }}>
            <Laurel size={56} color="var(--gold-deep)" />
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 12, letterSpacing: '0.22em', color: 'var(--gold-deep)',
              textTransform: 'uppercase', marginTop: 12,
            }}>Almost in</div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 44,
              margin: '8px 0 0', letterSpacing: '-0.01em',
            }}>Waiting for Russell</h1>
            <div style={{ marginTop: 18, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              Find Russell — he's the admin. Tell him your name<br/>
              and he'll approve you from his phone.
            </div>
          </div>

          <div style={{ padding: '8px 28px 12px' }}>
            <div style={{
              padding: '20px 22px',
              background: 'var(--paper)',
              border: '1px dashed var(--gold)',
              borderRadius: 'var(--r-md)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 700 }}>You</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginTop: 4 }}>
                {req?.firstName} {req?.lastInitial}
              </div>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 700, marginTop: 12 }}>
                Your PIN
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 32, letterSpacing: '0.4em',
                color: 'var(--ink)', marginTop: 4,
              }}>
                {req?.plainPin || req?.pin}
              </div>
              <div style={{
                marginTop: 12, padding: '8px 12px',
                background: 'var(--gold-faint)',
                borderRadius: 'var(--r-sm)',
                fontSize: 11, color: 'var(--gold-deep)', fontWeight: 600,
              }}>
                Write this down — you'll need it to sign back in
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 28px 24px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', gap: 6, alignItems: 'center',
              fontSize: 13, color: 'var(--ink-mute)',
            }}>
              <span className="pulse-dot" />
              Pending approval…
            </div>
            <style>{`.pulse-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);animation:pulse 1.2s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}`}</style>

            <button onClick={() => setPendingReqId(null)} className="btn btn-quiet"
              style={{ marginTop: 22 }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SIGN IN / REGISTER VIEW --------------------------------------
  return (
    <div className="app" style={{
      background: `radial-gradient(120% 80% at 50% 0%, var(--blush-soft) 0%, var(--bg) 55%)`,
    }}>
      <div className="app-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '54px 32px 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 18 }}>
            <Laurel size={56} color="var(--gold-deep)" />
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            letterSpacing: '0.22em',
            color: 'var(--gold-deep)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>Izzy & Kyle · 23 May 2026</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 64,
            lineHeight: 0.95,
            margin: 0,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}>Broulette</h1>
          <div style={{ marginTop: 8, fontStyle: 'italic', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-soft)' }}>
            Spin it. Sip it. Win it.
          </div>
          <div style={{ marginTop: 18 }}><Laurel size={56} color="var(--gold-deep)" /></div>
        </div>

        <div style={{ padding: '36px 28px 24px' }}>
          <div style={{
            display: 'flex',
            background: 'var(--paper-2)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--r-pill)',
            padding: 4,
            marginBottom: 22,
          }}>
            {['login', 'register'].map((m) => (
              <button key={m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, padding: '10px 0',
                  border: 0, borderRadius: 'var(--r-pill)',
                  background: mode === m ? 'var(--ink)' : 'transparent',
                  color: mode === m ? 'var(--paper)' : 'var(--ink-soft)',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}>
                {m === 'login' ? 'Sign in' : 'Join the game'}
              </button>
            ))}
          </div>

          <div className="stack-sm" style={{ marginBottom: 16 }}>
            <label className="field-label">First name</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
              <input className="input" value={firstName} placeholder="e.g. Izzy"
                onChange={(e) => setFn(e.target.value)} />
              <input className="input" value={lastInitial} placeholder="M"
                maxLength={2}
                style={{ textAlign: 'center', textTransform: 'uppercase' }}
                onChange={(e) => setLi(e.target.value.toUpperCase())} />
            </div>
          </div>

          <div className="stack-sm" style={{ marginBottom: 20 }}>
            <label className="field-label">
              {mode === 'register' ? 'Choose a 6-digit PIN' : '6-digit PIN'}
            </label>
            <input
              className="input input-pin"
              value={pin}
              maxLength={6}
              type="tel"
              inputMode="numeric"
              placeholder="••••••"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            {mode === 'register' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                background: 'var(--gold-faint)',
                border: '1px solid var(--gold)',
                borderRadius: 'var(--r-sm)',
                fontSize: 12, color: 'var(--gold-deep)',
                lineHeight: 1.4, fontWeight: 600,
                marginTop: 8,
              }}>
                <span style={{ fontSize: 18 }}>✍</span>
                <span>Write your PIN down — you'll need it to sign back in if you refresh.</span>
              </div>
            )}
          </div>

          {err && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--r-sm)',
              background: 'rgba(180, 98, 107, 0.12)',
              color: 'var(--bad)',
              fontSize: 13,
              marginBottom: 14,
            }}>{err}</div>
          )}

          <button onClick={submit} className="btn btn-gold btn-block" style={{ fontSize: 16 }}>
            {mode === 'login' ? 'Sign in' : 'Request to join'}
          </button>

          {mode === 'register' && (
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.4 }}>
              You pick your own 6-digit PIN.<br />
              Russell will approve your sign-up before you can play.
            </div>
          )}

          <div style={{
            marginTop: 28,
            padding: '14px 16px',
            background: 'rgba(201, 169, 97, 0.1)',
            border: '1px dashed var(--gold)',
            borderRadius: 'var(--r-sm)',
            fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--gold-deep)', marginBottom: 4, letterSpacing: '0.1em', fontSize: 10, textTransform: 'uppercase' }}>House rules</div>
            Every 30 min, you get <b>+5 sips</b> automatically. Want more?
            Drink IRL and ask Russell. Bet on chaos. Spin the wheel.
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────
function DashboardScreen({ me, setTab, openSend, openCreateBet, openDebt, onLogout }) {
  const store = useStore();
  const s = store.state;
  const nextDrop = store.timeToNextRound();
  const rouletteOpen = s.rouletteOpen;
  const timeToSpin = store.timeToSpin();
  const openBets = s.bets.filter((b) => b.status === 'open').length;

  return (
    <>
      <div className="page-head" style={{
        background: 'linear-gradient(180deg, var(--paper-2) 0%, var(--bg) 100%)',
        borderBottom: 0,
      }}>
        <button
          onClick={onLogout}
          style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar player={me} size="sm" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)', lineHeight: 1 }}>
              {me.firstName} {me.lastInitial}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
              {me.isAdmin ? 'Admin · Round ' + s.currentRound : 'Round ' + s.currentRound}
            </div>
          </div>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
          <Ico.Clock width={14} height={14} />
          <span className="num">{fmtMSS(nextDrop)}</span>
        </div>
      </div>

      {/* Balance Hero */}
      <div style={{ padding: '24px 24px 12px', textAlign: 'center' }}>
        <div className="eyebrow gold" style={{ marginBottom: 6 }}>Your sips</div>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
          <DrinkCount value={me.balance} />
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink-mute)' }}>sips</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6, letterSpacing: '0.04em' }}>
          ≈ {(me.balance / 10).toFixed(1)} full drinks · 10 sips = 1 drink
        </div>
        <Ornament glyph="✦  ✦  ✦" />
      </div>

      {/* Sips this round — who sent you what, who you sent to */}
      <SipsThisRoundCard me={me} store={store} onOpenSend={openSend} />

      {/* Roulette / Countdown card */}
      <div style={{ padding: '0 18px 14px' }}>
        <button
          onClick={() => setTab('wheel')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            background: rouletteOpen
              ? 'linear-gradient(125deg, var(--blush-deep), var(--burgundy))'
              : 'var(--paper)',
            color: rouletteOpen ? '#FFF' : 'var(--ink)',
            border: rouletteOpen ? '0' : '1px solid var(--line-soft)',
            borderRadius: 'var(--r-md)',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: 'var(--shadow-sm)',
          }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 12,
            background: rouletteOpen ? 'rgba(255,255,255,0.16)' : 'var(--blush-soft)',
            color: rouletteOpen ? '#FFF' : 'var(--blush-rose)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ico.Wheel width={28} height={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.05 }}>
              {rouletteOpen ? 'Place your wheel bets' : 'Wheel opens'}
            </div>
            <div style={{
              fontSize: 12, opacity: rouletteOpen ? 0.9 : 0.6, marginTop: 3,
              letterSpacing: '0.05em',
            }}>
              {rouletteOpen
                ? <>Spins in <span className="num">{fmtMSS(timeToSpin)}</span></>
                : <>Next spin in <span className="num">{fmtMSS(nextDrop)}</span></>}
            </div>
          </div>
          <Ico.ChevR width={20} height={20} style={{ opacity: 0.6 }} />
        </button>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '0 18px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction icon={<Ico.Send />} label="Send sips" sub="Make 'em drink" onClick={openSend} />
          <QuickAction icon={<Ico.Plus />} label="Create bet" sub="3 sips" onClick={openCreateBet} />
          <QuickAction icon={<Ico.Bets />} label="Browse bets" sub={`${openBets} open`} onClick={() => setTab('bets')} />
          <QuickAction
            icon={<Ico.Glass />}
            label="Buy more sips"
            sub={`${store.sipsRemainingThisRound(me.id)} left this round`}
            onClick={openDebt} />
        </div>
      </div>

      {/* Hot bets */}
      <div style={{ padding: '6px 22px 8px' }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="eyebrow">Hot bets</div>
          <button onClick={() => setTab('bets')} style={{ background: 'transparent', border: 0, color: 'var(--blush-rose)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>See all →</button>
        </div>
      </div>
      <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {s.bets.filter((b) => b.status === 'open').slice(0, 2).map((b) => (
          <BetCardMini key={b.id} bet={b} onClick={() => setTab('bets', { detailId: b.id })} />
        ))}
        {s.bets.filter((b) => b.status === 'open').length === 0 &&
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
            No open bets right now.
          </div>
        }
      </div>

      {/* Activity preview */}
      <div style={{ padding: '6px 22px 8px' }}>
        <div className="eyebrow">Latest</div>
      </div>
      <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {s.activity.slice(0, 3).map((a) => (
          <ActivityRow key={a.id} entry={a} compact />
        ))}
      </div>
    </>
  );
}

function QuickAction({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: 4,
      padding: '14px 14px',
      background: 'var(--paper)',
      border: '1px solid var(--line-soft)',
      borderRadius: 'var(--r-md)',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'var(--ink)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'var(--paper-2)', color: 'var(--blush-rose)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 6,
      }}>
        {React.cloneElement(icon, { width: 18, height: 18 })}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{sub}</div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// WAITING LOBBY — shown before Russell starts the game
// ────────────────────────────────────────────────────────────
function WaitingLobbyScreen({ me, onLogout }) {
  const store = useStore();
  const s = store.state;
  return (
    <div className="app" style={{
      background: `radial-gradient(120% 80% at 50% 0%, var(--blush-soft) 0%, var(--bg) 55%)`,
    }}>
      <div className="app-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="page-head" style={{
          background: 'transparent', borderBottom: 0, padding: '14px 22px 8px',
        }}>
          <button onClick={onLogout} style={{
            background: 'transparent', border: 0, padding: 4, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Avatar player={me} size="sm" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, lineHeight: 1 }}>
                {me.firstName} {me.lastInitial}
              </div>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                {me.isAdmin ? 'Admin · waiting' : "You're in"}
              </div>
            </div>
          </button>
        </div>

        <div style={{ padding: '40px 28px 0', textAlign: 'center' }}>
          <Laurel size={72} color="var(--gold-deep)" />
          <div className="eyebrow gold" style={{ marginTop: 16 }}>The game</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: 56, lineHeight: 1, margin: '4px 0 0',
            letterSpacing: '-0.01em',
          }}>Hasn't started yet</h1>
          <div style={{
            marginTop: 14, fontSize: 14, lineHeight: 1.55,
            color: 'var(--ink-soft)', maxWidth: 320, margin: '14px auto 0',
          }}>
            {me.isAdmin
              ? "Tap the button below when you're ready to begin. Everyone signed in will get their first 5 sips and the wheel will open."
              : <>Hold tight. <b>Russell</b> will kick things off when the ceremony's done.</>}
          </div>
        </div>

        {/* Who's in */}
        <div style={{ padding: '28px 22px 0' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {s.players.filter(p => !p.hidden).length} {s.players.filter(p => !p.hidden).length === 1 ? 'player' : 'players'} so far
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {s.players.filter(p => !p.hidden).map((p) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 4px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--line-soft)',
                  borderRadius: 999,
                  fontSize: 12,
                }}>
                  <Avatar player={p} size="sm" />
                  <span>{p.firstName} {p.lastInitial}{p.isAdmin ? ' ★' : ''}{p.id === me.id ? ' (you)' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Admin: Start button */}
        {me.isAdmin && (
          <div style={{ padding: '24px 22px 24px' }}>
            <button onClick={() => store.startGame()}
              className="btn btn-gold btn-block"
              style={{ fontSize: 18, padding: '20px 24px', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              START THE GAME →
            </button>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center', marginTop: 10 }}>
              First round starts immediately. +5 sips to everyone. Wheel opens for 5 min of betting.
            </div>
          </div>
        )}
        {!me.isAdmin && (
          <div style={{ padding: '24px 22px 24px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', gap: 6, alignItems: 'center',
              fontSize: 13, color: 'var(--ink-mute)',
            }}>
              <span className="pulse-dot" />
              Waiting for Russell…
            </div>
          </div>
        )}

        {/* House rules teaser */}
        <div style={{ padding: '0 28px 36px' }}>
          <div style={{
            padding: '14px 16px',
            background: 'rgba(201, 169, 97, 0.1)',
            border: '1px dashed var(--gold)',
            borderRadius: 'var(--r-sm)',
            fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--gold-deep)', marginBottom: 4, letterSpacing: '0.1em', fontSize: 10, textTransform: 'uppercase' }}>House rules</div>
            10 sips = 1 drink. Free +5 sips every 30 min, plus up to 5 you can buy from Russell.
            Bet on the chaos. Spin the wheel. Whoever has the most sips at the end wins.
          </div>
        </div>
      </div>
    </div>
  );
}
function SipsThisRoundCard({ me, store, onOpenSend }) {
  const s = store.state;
  const [expanded, setExpanded] = useS(false);
  const roundStart = s.gameStartedAtVirtual + (s.currentRound - 1) * s.roundLen;
  // Filter for transfers involving me in the current round
  const transfers = s.activity.filter((a) =>
    a.type === 'transfer' && a._vtime != null && a._vtime >= roundStart &&
    a.data && (a.data.toId === me.id || a.data.fromId === me.id)
  );
  const received = transfers.filter((a) => a.data.toId === me.id);
  const sent = transfers.filter((a) => a.data.fromId === me.id);
  const totalReceived = received.reduce((a, b) => a + (b.data.amount || 0), 0);
  const totalSent     = sent.reduce((a, b) => a + (b.data.amount || 0), 0);

  // Empty state
  if (received.length === 0 && sent.length === 0) {
    return (
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          padding: '14px 16px',
          background: 'var(--paper)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--paper-2)', color: 'var(--ink-mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Ico.Send width={18} height={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Sips to drink</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              No one's made you drink yet. Send sips to punish someone!
            </div>
          </div>
          <button onClick={onOpenSend} className="btn btn-quiet btn-sm">Send</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px 14px' }}>
      <div style={{
        padding: '14px 14px 12px',
        background: totalReceived > 0 ? 'rgba(180, 98, 107, 0.06)' : 'var(--paper)',
        border: totalReceived > 0 ? '1px solid rgba(180, 98, 107, 0.25)' : '1px solid var(--line-soft)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Punishment total */}
        {totalReceived > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700,
              color: 'var(--burgundy)', lineHeight: 1,
            }}>{totalReceived}</div>
            <div>
              <div className="eyebrow" style={{ color: 'var(--burgundy)', marginBottom: 1 }}>Sips to drink this round</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                From {received.length} send{received.length === 1 ? '' : 's'}
                {totalSent > 0 && <> · you sent {totalSent} to others</>}
              </div>
            </div>
          </div>
        )}
        {totalReceived === 0 && totalSent > 0 && (
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="eyebrow">Punishments dealt</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              <span style={{ color: 'var(--blush-rose)', fontWeight: 700 }}>{totalSent}</span> sips sent to others
            </div>
          </div>
        )}

        {/* Who sent you sips (expandable) */}
        <button onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            fontSize: 11, color: 'var(--ink-mute)', textDecoration: 'underline',
            marginBottom: expanded ? 8 : 0,
          }}>
          {expanded ? 'Hide details' : `See who${received.length > 0 ? ' sent you sips' : ''}`}
        </button>
        {expanded && (
          <div className="stack-sm" style={{ gap: 8 }}>
            {received.map((a) => {
              const sender = store.getPlayer(a.data.fromId);
              return (
                <div key={a.id} className="row" style={{ gap: 10 }}>
                  <Avatar player={sender} size="sm" />
                  <span style={{ flex: 1, fontSize: 13, lineHeight: 1.2 }}>
                    <b>{sender?.firstName} {sender?.lastInitial}</b>
                    <span style={{ color: 'var(--ink-mute)' }}> says drink</span>
                  </span>
                  <span className="num" style={{ color: 'var(--burgundy)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 18 }}>
                    {a.data.amount}
                  </span>
                </div>
              );
            })}
            {sent.map((a) => {
              const recip = store.getPlayer(a.data.toId);
              return (
                <div key={a.id} className="row" style={{ gap: 10, opacity: 0.7 }}>
                  <Avatar player={recip} size="sm" />
                  <span style={{ flex: 1, fontSize: 13, lineHeight: 1.2 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>You told </span>
                    <b>{recip?.firstName} {recip?.lastInitial}</b>
                    <span style={{ color: 'var(--ink-mute)' }}> to drink</span>
                  </span>
                  <span className="num" style={{ color: 'var(--blush-rose)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 18 }}>
                    {a.data.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// BETS — list, detail (wager), create
// ────────────────────────────────────────────────────────────
function BetCardMini({ bet, onClick }) {
  const pool = bet.totalFor + bet.totalAgainst;
  const forPct = pool ? Math.round((bet.totalFor / pool) * 100) : 50;
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 14px',
      background: 'var(--paper)',
      border: '1px solid var(--line-soft)',
      borderRadius: 'var(--r-md)',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'var(--ink)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.2, color: 'var(--ink)' }}>
        "{bet.proposition}"
      </div>
      <PoolBar forAmt={bet.totalFor} againstAmt={bet.totalAgainst} />
      <div className="row between" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
        <span>{bet.wagers.length} wager{bet.wagers.length === 1 ? '' : 's'} · {pool} sips in pot</span>
        <span style={{ color: 'var(--blush-rose)', fontWeight: 600 }}>Tap to bet →</span>
      </div>
    </button>
  );
}

function PoolBar({ forAmt, againstAmt, height = 8 }) {
  const total = Math.max(1, forAmt + againstAmt);
  const forPct = (forAmt / total) * 100;
  return (
    <div>
      <div style={{
        height,
        background: 'var(--paper-2)',
        borderRadius: 999,
        overflow: 'hidden',
        display: 'flex',
        border: '1px solid var(--line-soft)',
      }}>
        <div style={{ width: `${forPct}%`, background: 'var(--sage-deep)' }} />
        <div style={{ width: `${100 - forPct}%`, background: 'var(--blush-deep)' }} />
      </div>
      <div className="row between" style={{ marginTop: 4, fontSize: 11 }}>
        <span style={{ color: 'var(--sage-deep)', fontWeight: 600 }}>YES · {forAmt}</span>
        <span style={{ color: 'var(--blush-deep)', fontWeight: 600 }}>{againstAmt} · NO</span>
      </div>
    </div>
  );
}

function BetsScreen({ me, openCreateBet, detailId, setDetailId }) {
  const store = useStore();
  const s = store.state;
  const [filter, setFilter] = useS('open');

  const bet = detailId ? s.bets.find((b) => b.id === detailId) : null;
  if (bet) return <BetDetailScreen me={me} bet={bet} onBack={() => setDetailId(null)} />;

  const filtered = s.bets.filter((b) => {
    if (filter === 'open') return b.status === 'open';
    if (filter === 'mine') return b.wagers.some((w) => w.playerId === me.id) || b.createdBy === me.id;
    if (filter === 'past') return b.status.startsWith('resolved') || b.status === 'expired';
  });

  return (
    <>
      <PageHead title="Bets" subtitle="Place your wagers" />
      <div style={{ padding: '8px 18px 8px', display: 'flex', gap: 8 }}>
        {[
          { id: 'open', l: 'Open' },
          { id: 'mine', l: 'Mine' },
          { id: 'past', l: 'Past' },
        ].map((f) => (
          <button key={f.id}
            onClick={() => setFilter(f.id)}
            className={`pill ${filter === f.id ? 'pill-ink' : 'pill-line'}`}
            style={{ border: 0, cursor: 'pointer', padding: '7px 14px' }}>
            {f.l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={openCreateBet} className="btn btn-blush btn-sm">
          <Ico.Plus width={14} height={14} /> New bet
        </button>
      </div>

      <div style={{ padding: '8px 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((b) =>
          b.status === 'open'
            ? <BetCardMini key={b.id} bet={b} onClick={() => setDetailId(b.id)} />
            : <BetCardPast key={b.id} bet={b} me={me} onClick={() => setDetailId(b.id)} />
        )}
        {!filtered.length && (
          <EmptyState glyph="❦" title="Nothing here yet" hint={
            filter === 'open' ? 'Be the first to make some chaos.' :
            filter === 'mine' ? 'No bets yet. Find a hot one!' :
            'No resolved bets yet.'
          } />
        )}
      </div>
    </>
  );
}

function BetCardPast({ bet, me, onClick }) {
  const myWager = bet.wagers.find((w) => w.playerId === me.id);
  const won = bet.status === 'resolved_won';
  const winnerSide = won ? 'for' : 'against';
  return (
    <div style={{
      padding: '14px',
      background: 'var(--paper)',
      border: '1px solid var(--line-soft)',
      borderRadius: 'var(--r-md)',
      opacity: 0.85,
    }} onClick={onClick}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-soft)', marginBottom: 8 }}>
        "{bet.proposition}"
      </div>
      <div className="row between">
        <span className={`pill ${won ? 'pill-sage' : 'pill-blush'}`}>
          {won ? 'YES won' : 'NO won'}
        </span>
        {myWager && (
          <span style={{ fontSize: 13, fontWeight: 600, color: myWager.side === winnerSide ? 'var(--sage-deep)' : 'var(--bad)' }}>
            {myWager.side === winnerSide ? `+${myWager.payout || 0}` : `−${myWager.amount}`} sips
          </span>
        )}
      </div>
    </div>
  );
}

function BetDetailScreen({ me, bet, onBack }) {
  const store = useStore();
  const [side, setSide] = useS(null);
  const [amount, setAmount] = useS(2);
  const [posting, setPosting] = useS(false);
  const myWagers = bet.wagers.filter((w) => w.playerId === me.id);

  const pool = bet.totalFor + bet.totalAgainst;
  // estimated payout for me — 1.5× floor for everyone (rounded up)
  const estPayout = useM(() => {
    if (!side) return 0;
    const winningPool = (side === 'for' ? bet.totalFor : bet.totalAgainst) + amount;
    const total = pool + amount;
    let p = Math.ceil((amount / winningPool) * total);
    p = Math.max(p, Math.ceil(amount * 1.5));
    return p;
  }, [side, amount, bet]);

  const submitWager = async () => {
    setPosting(true);
    const res = await store.placeWager({ betId: bet.id, playerId: me.id, side, amount });
    setPosting(false);
    if (res.ok) { setSide(null); setAmount(2); }
  };

  const creator = store.getPlayer(bet.createdBy);

  return (
    <>
      <div className="page-head" style={{ padding: '14px 16px 14px' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: 8, cursor: 'pointer', color: 'var(--ink)' }}>
          <Ico.Back width={22} height={22} />
        </button>
        <div className="subtitle">Open bet</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.15, color: 'var(--ink)', marginBottom: 12 }}>
          "{bet.proposition}"
        </div>
        <div className="row" style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 16 }}>
          {creator && <Avatar player={creator} size="sm" />}
          <span>Proposed by {creator?.firstName} {creator?.lastInitial}</span>
          <span>·</span>
          <span>{pool} sips in pot</span>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <PoolBar forAmt={bet.totalFor} againstAmt={bet.totalAgainst} height={12} />
      </div>

      {/* Side picker */}
      <div style={{ padding: '8px 24px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Pick a side</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'for', l: 'Yes, it happens', color: 'var(--sage-deep)', bg: 'var(--sage-soft)' },
            { id: 'against', l: 'No way', color: 'var(--blush-rose)', bg: 'var(--blush-soft)' },
          ].map((opt) => (
            <button key={opt.id}
              onClick={() => setSide(opt.id)}
              style={{
                padding: '16px 12px',
                background: side === opt.id ? opt.color : opt.bg,
                color: side === opt.id ? '#FFF' : opt.color,
                border: 0,
                borderRadius: 'var(--r-md)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                lineHeight: 1.1,
                transition: 'background .15s, color .15s',
              }}>
              {opt.l}
              <div style={{
                fontSize: 11, marginTop: 6, fontFamily: 'var(--font-body)', fontWeight: 600,
                opacity: side === opt.id ? 0.85 : 0.7,
              }}>
                {opt.id === 'for' ? `${bet.totalFor} on YES` : `${bet.totalAgainst} on NO`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount + place */}
      {side && (
        <div style={{ padding: '20px 24px 8px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>How many sips?</div>
          <Stepper value={amount} onChange={setAmount} min={1} max={me.balance} />
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--gold-faint)', borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--ink-soft)' }}>
            If you win, you take home <b className="num" style={{ color: 'var(--gold-deep)' }}>~{estPayout} sips</b>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
              {me.balance >= amount ? `${me.balance - amount} left after wager` : `Need ${amount - me.balance} more sips`}
            </div>
          </div>
          <button
            disabled={amount > me.balance || posting}
            onClick={submitWager}
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}>
            Place {amount} sip{amount === 1 ? '' : 's'} on {side === 'for' ? 'YES' : 'NO'}
          </button>
        </div>
      )}

      {/* Your existing wagers */}
      {myWagers.length > 0 && (
        <div style={{ padding: '18px 24px 8px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your wagers</div>
          <div className="stack-sm">
            {myWagers.map((w) => (
              <div key={w.id} className="row between" style={{
                padding: '10px 14px', background: 'var(--paper)', border: '1px solid var(--line-soft)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span className={`pill ${w.side === 'for' ? 'pill-sage' : 'pill-blush'}`}>{w.side === 'for' ? 'YES' : 'NO'}</span>
                <span className="num"><b>{w.amount}</b> sips</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wagers list */}
      <div style={{ padding: '18px 24px 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>The pot</div>
        <div className="stack-sm">
          {bet.wagers.map((w) => {
            const p = store.getPlayer(w.playerId);
            return (
              <div key={w.id} className="row between" style={{ padding: '8px 0' }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar player={p} size="sm" />
                  <span style={{ fontSize: 14 }}>{p?.firstName} {p?.lastInitial}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className={`pill ${w.side === 'for' ? 'pill-sage' : 'pill-blush'}`}>{w.side === 'for' ? 'YES' : 'NO'}</span>
                  <span className="num" style={{ fontWeight: 600 }}>{w.amount}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function CreateBetSheet({ open, onClose, me }) {
  const store = useStore();
  const [prop, setProp] = useS('');
  const [err, setErr] = useS('');
  const submit = async () => {
    setErr('');
    if (prop.trim().length < 8) { setErr('Make it a real proposition.'); return; }
    const r = await store.createBet({ createdBy: me.id, proposition: prop.trim() });
    if (r.error) { setErr(r.error); return; }
    setProp('');
    onClose();
  };

  const suggestions = [
    "Best man fluffs the speech",
    "Father of the bride cries during his speech",
    "Aunty P attempts the worm on the dance floor",
    "DJ plays Mr Brightside more than once",
    "Kyle cries first (not Izzy) during the speeches",
    "Cake survives the night untouched",
    "Someone proposes during the night",
    "Russell takes a turn on the decks",
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Propose a bet">
      <div className="stack" style={{ paddingBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Costs <b>3 sips</b>. Russell will approve it. Must resolve within 1 hour.
          Minimum payout if you win: <b>1.5× your wager</b>, rounded up.
        </div>
        <div className="stack-sm">
          <label className="field-label">The proposition</label>
          <textarea
            className="input"
            rows={3}
            value={prop}
            placeholder="e.g. Father of the bride cries during his speech"
            onChange={(e) => setProp(e.target.value)} />
        </div>

        <div className="stack-sm">
          <label className="field-label">Stuck? Try one of these</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s) => (
              <button key={s}
                onClick={() => setProp(s)}
                className="pill pill-line"
                style={{ border: 0, boxShadow: 'inset 0 0 0 1px var(--line)', cursor: 'pointer', fontSize: 11, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {err && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{err}</div>}

        <div className="row between" style={{ paddingTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            You have <b className="num" style={{ color: 'var(--ink)' }}>{me.balance}</b> sips.
          </span>
          {me.balance < 3 && <span style={{ fontSize: 12, color: 'var(--bad)' }}>Need 3 to create</span>}
        </div>
        <button onClick={submit} className="btn btn-gold btn-block" disabled={me.balance < 3}>
          Propose bet — 3 sips
        </button>
      </div>
    </Sheet>
  );
}

// ────────────────────────────────────────────────────────────
// SEND SIPS
// ────────────────────────────────────────────────────────────
function SendDrinksSheet({ open, onClose, me }) {
  const store = useStore();
  const [pickedId, setPickedId] = useS(null);
  const [amount, setAmount] = useS(2);
  const [search, setSearch] = useS('');
  const [confirm, setConfirm] = useS(false);
  const [err, setErr] = useS('');

  useE(() => { if (!open) { setPickedId(null); setAmount(2); setConfirm(false); setSearch(''); setErr(''); } }, [open]);

  const others = store.state.players
    .filter((p) => p.id !== me.id && !p.hidden)
    .filter((p) => `${p.firstName} ${p.lastInitial}`.toLowerCase().includes(search.toLowerCase()));
  const picked = pickedId ? store.getPlayer(pickedId) : null;

  const send = async () => {
    setErr('');
    const r = await store.transferDrinks({ fromId: me.id, toId: pickedId, amount });
    if (r.error) { setErr(r.error); return; }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Make someone drink">
      {!confirm && (
        <div className="stack">
          <div className="stack-sm">
            <label className="field-label">Who?</label>
            <input className="input" placeholder="Find a player…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
            {others.map((p) => (
              <button key={p.id}
                onClick={() => setPickedId(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 12px',
                  border: 0, borderRadius: 'var(--r-sm)',
                  background: pickedId === p.id ? 'var(--gold-faint)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <Avatar player={p} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{p.firstName} {p.lastInitial}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)' }} className="num">{p.balance} sips</div>
                </div>
                {pickedId === p.id && <Ico.Check width={20} height={20} style={{ color: 'var(--gold-deep)' }} />}
              </button>
            ))}
          </div>
          <button disabled={!pickedId} className="btn btn-primary btn-block"
            onClick={() => setConfirm(true)}>
            Pick amount →
          </button>
        </div>
      )}
      {confirm && picked && (
        <div className="stack-lg">
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <Avatar player={picked} size="lg" />
            <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 22 }}>
              For {picked.firstName} {picked.lastInitial}
            </div>
          </div>
          <Stepper value={amount} onChange={setAmount} min={1} max={me.balance} />
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', textAlign: 'center' }}>
            You'll have <b className="num" style={{ color: 'var(--ink)' }}>{me.balance - amount}</b> sips left
          </div>
          {err && <div style={{ color: 'var(--bad)', fontSize: 13, textAlign: 'center' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirm(false)} className="btn btn-ghost" style={{ flex: 1 }}>Back</button>
            <button onClick={send} className="btn btn-blush" style={{ flex: 2 }}>Make them drink {amount}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ────────────────────────────────────────────────────────────
// BUY MORE SIPS (request from Russell)
// ────────────────────────────────────────────────────────────
function DebtSheet({ open, onClose, me }) {
  const store = useStore();
  const remaining = store.sipsRemainingThisRound(me.id);
  const already   = store.sipsRequestedThisRound(me.id);
  const [amount, setAmount] = useS(Math.min(2, Math.max(1, remaining)));
  const [sent, setSent] = useS(false);
  const [err, setErr] = useS('');
  useE(() => {
    if (!open) { setAmount(Math.min(2, Math.max(1, remaining))); setSent(false); setErr(''); }
  }, [open]);

  const submit = async () => {
    setErr('');
    const r = await store.requestSips({ playerId: me.id, amount });
    if (r.error) { setErr(r.error); return; }
    setSent(true);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Buy more sips">
      {!sent && (
        <div className="stack">
          <div style={{
            padding: '14px 16px',
            background: 'var(--gold-faint)',
            borderRadius: 'var(--r-sm)',
            fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5,
          }}>
            Take your {amount} sip{amount === 1 ? '' : 's'} IRL, then show Russell.
            He'll approve and the sips will appear on your balance.
          </div>

          <div className="row between" style={{
            padding: '12px 14px',
            background: 'var(--paper-2)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--line-soft)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>This round, you can buy</span>
            <span className="num" style={{ fontWeight: 700, color: remaining > 0 ? 'var(--ink)' : 'var(--bad)' }}>
              {remaining} / 5 sip{remaining === 1 ? '' : 's'}
            </span>
          </div>

          {remaining > 0 ? (
            <>
              <Stepper value={amount} onChange={setAmount} min={1} max={remaining} />
              {err && <div style={{ color: 'var(--bad)', fontSize: 13, textAlign: 'center' }}>{err}</div>}
              <button onClick={submit} className="btn btn-blush btn-block">
                Request {amount} sip{amount === 1 ? '' : 's'} from Russell
              </button>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center' }}>
                Already requested this round: {already}
              </div>
            </>
          ) : (
            <div style={{
              padding: 16, textAlign: 'center',
              background: 'var(--blush-soft)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--burgundy)',
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17,
            }}>
              You've maxed your extra sips this round.<br />
              Wait for the next auto drop.
            </div>
          )}
        </div>
      )}
      {sent && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 48 }}>⏳</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 6 }}>Request sent</div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 6, lineHeight: 1.5 }}>
            Find Russell with your {amount} sip{amount === 1 ? '' : 's'}.<br />
            He'll approve and the sips will drop into your balance.
          </div>
          <button onClick={onClose} className="btn btn-quiet" style={{ marginTop: 16 }}>Close</button>
        </div>
      )}
    </Sheet>
  );
}

// ────────────────────────────────────────────────────────────
// RULES DIALOG — shown on each login
// ────────────────────────────────────────────────────────────
function RulesDialog({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="dialog-scrim" onClick={onClose} style={{ alignItems: 'flex-end', padding: 0 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--paper)',
          borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          padding: '8px 0 0',
          maxHeight: '92%',
          display: 'flex', flexDirection: 'column',
          animation: 'sheetUp .35s cubic-bezier(.2,.7,.3,1)',
          boxShadow: '0 -10px 40px rgba(0,0,0,.18)',
        }}>
        <div className="sheet-handle" />
        <div style={{ padding: '12px 28px 0', textAlign: 'center' }}>
          <Laurel size={48} color="var(--gold-deep)" />
          <div style={{
            marginTop: 4,
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'var(--gold-deep)',
          }}>How Broulette works</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: 40, margin: '4px 0 0', lineHeight: 1,
          }}>The house rules</h2>
        </div>
        <div style={{
          flex: 1, overflowY: 'auto', padding: '18px 24px 12px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)',
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
          }}>
            It's Polymarket + a roulette wheel, but a drinking game.
          </p>

          <RuleRow num="1" title="Sips are the currency">
            <b>10 sips = 1 whole drink.</b> Every value in the game is in sips —
            so a "5-sip bet" means five small sips.
          </RuleRow>

          <RuleRow num="2" title="Free sips every 30 minutes">
            Every 30 min, the game drops <b>+5 sips</b> into your balance —
            automatic, no questions asked. Look for the round timer at the top.
          </RuleRow>

          <RuleRow num="3" title="Want more? Buy them.">
            Drink IRL and tap <b>Buy more sips</b>. Russell approves it and you
            get credit. Max <b>5 extra sips per round</b>.
          </RuleRow>

          <RuleRow num="4" title="Bet on the chaos">
            Anyone can propose a bet ("Uncle Dave cries in his speech") for 3 sips.
            Russell approves it; everyone else wagers YES or NO. Winners split the pot
            proportionally. <b>Creator wins at least 2×</b> their wager if they're right.
          </RuleRow>

          <RuleRow num="5" title="The wheel — one spin a round">
            Every round, the wheel opens for <b>5 minutes of betting</b>.
            Stake sips on the slice you think will hit (Cheers, Jackpot, Sip Back…).
            When the window closes, the wheel spins <b>once</b>. Winning slice pays
            out <b>amount × multiplier</b>. Losing slices are gone.
          </RuleRow>

          <RuleRow num="6" title="Be generous (or not)">
            Spend your sips to make someone drink. The ultimate power move.
            Bribes for the bride. No questions asked.
          </RuleRow>

          <div className="div-orn" style={{ marginTop: 4 }}><span className="glyph">Most sips at night's end wins</span></div>
        </div>

        {/* Pinned CTA so it stays visible above the scroll on small screens */}
        <div style={{
          padding: '12px 24px 20px',
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--paper)',
          boxShadow: '0 -8px 16px rgba(60,40,20,.06)',
        }}>
          <button onClick={onClose} className="btn btn-gold btn-block">
            Got it — let's play
          </button>
        </div>
      </div>
    </div>
  );
}
function RuleRow({ num, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--gold-faint)', color: 'var(--gold-deep)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 18,
        flexShrink: 0,
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ACTIVITY FEED
// ────────────────────────────────────────────────────────────
function ActivityRow({ entry, compact }) {
  const ico = activityIcon(entry.type);
  return (
    <div style={{
      display: 'flex', gap: 12, padding: compact ? '8px 4px' : '12px 6px',
      borderBottom: compact ? 0 : '1px solid var(--line-soft)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: ico.bg, color: ico.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--font-display)', fontSize: 16,
      }}>{ico.glyph}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>{entry.message}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{fmtActivityAge(entry)}</div>
      </div>
    </div>
  );
}

function activityIcon(type) {
  const map = {
    credit_drop:  { glyph: '⊕', bg: 'var(--gold-faint)', fg: 'var(--gold-deep)' },
    roulette_win: { glyph: '★', bg: 'var(--gold-faint)', fg: 'var(--gold-deep)' },
    roulette_loss:{ glyph: '☠', bg: 'var(--blush-soft)', fg: 'var(--burgundy)' },
    bet_resolved: { glyph: '✓', bg: 'var(--sage-soft)', fg: 'var(--sage-deep)' },
    bet_created:  { glyph: '✦', bg: 'var(--blush-soft)', fg: 'var(--blush-rose)' },
    bet_approved: { glyph: '✓', bg: 'var(--sage-soft)', fg: 'var(--sage-deep)' },
    wager_placed: { glyph: '◇', bg: 'var(--paper-2)',  fg: 'var(--ink-soft)' },
    transfer:     { glyph: '↦', bg: 'var(--blush-soft)',fg: 'var(--blush-rose)' },
    debt_approved:{ glyph: '⊙', bg: 'var(--paper-2)',  fg: 'var(--ink)' },
    mini_game:    { glyph: '◆', bg: 'var(--gold-faint)',fg: 'var(--gold-deep)' },
    roulette_open:{ glyph: '⟳', bg: 'var(--blush-soft)',fg: 'var(--blush-rose)' },
  };
  return map[type] || { glyph: '•', bg: 'var(--paper-2)', fg: 'var(--ink-mute)' };
}

function ActivityScreen() {
  const store = useStore();
  const s = store.state;
  return (
    <>
      <PageHead title="The Feed" subtitle="Live happenings" />
      <div style={{ padding: '0 18px 24px' }}>
        {s.activity.map((a) => <ActivityRow key={a.id} entry={a} />)}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// LEADERBOARD
// ────────────────────────────────────────────────────────────
function LeaderboardScreen({ me }) {
  const store = useStore();
  const players = [...store.state.players].filter(p => !p.hidden).sort((a, b) => b.balance - a.balance);
  const winners = players.slice(0, 5);
  const losers = players.slice(-3).reverse();

  return (
    <>
      <PageHead title="Top of the Class" subtitle="Sippers' standings" />

      <div style={{ padding: '14px 18px 6px' }}>
        <div className="eyebrow gold" style={{ marginBottom: 12 }}>The sippers</div>
      </div>

      {/* Podium */}
      <div style={{ padding: '0 18px 18px', display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
        {[winners[1], winners[0], winners[2]].filter(Boolean).map((p, i) => {
          const rank = [2, 1, 3][i];
          const heights = { 1: 160, 2: 130, 3: 110 };
          const isMe = p.id === me.id;
          return (
            <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Avatar player={p} size="lg" />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>
                {p.firstName}{isMe ? ' (you)' : ''}
              </div>
              <div className="num" style={{ fontSize: 13, color: 'var(--ink-mute)' }}>{p.balance} sips</div>
              <div style={{
                width: '100%', height: heights[rank] - 80,
                marginTop: 6,
                background: rank === 1 ? 'linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%)'
                          : rank === 2 ? 'linear-gradient(180deg, var(--ink-faint) 0%, var(--ink-mute) 100%)'
                          : 'linear-gradient(180deg, var(--blush) 0%, var(--blush-deep) 100%)',
                borderRadius: '8px 8px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 30, color: '#FFF',
                boxShadow: 'var(--shadow-sm)',
              }}>
                {rank}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full list */}
      <div style={{ padding: '0 18px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>All standings</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {players.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              borderBottom: i === players.length - 1 ? 0 : '1px solid var(--line-soft)',
              background: p.id === me.id ? 'var(--gold-faint)' : 'transparent',
            }}>
              <div style={{ width: 22, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-mute)' }}>{i + 1}</div>
              <Avatar player={p} size="sm" />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                {p.firstName} {p.lastInitial}{p.id === me.id ? ' · you' : ''}
              </div>
              <div className="num" style={{ fontWeight: 700 }}>{p.balance}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wooden spoon */}
      <div style={{ padding: '8px 18px 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--burgundy)' }}>The wooden spoon</div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 10 }}>
          Closest to broke. Send them mercy sips.
        </div>
        <div className="stack-sm">
          {losers.map((p) => (
            <div key={p.id} className="row" style={{
              padding: '10px 14px', background: 'var(--blush-soft)',
              borderRadius: 'var(--r-sm)',
            }}>
              <Avatar player={p} size="sm" />
              <div style={{ flex: 1, fontWeight: 500 }}>{p.firstName} {p.lastInitial}</div>
              <div className="num" style={{ color: 'var(--burgundy)', fontWeight: 700 }}>{p.balance}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  LoginScreen, WaitingLobbyScreen, DashboardScreen, BetsScreen, CreateBetSheet,
  SendDrinksSheet, DebtSheet, RulesDialog, ActivityScreen, LeaderboardScreen,
  ActivityRow, BetCardMini, PoolBar, BetDetailScreen, QuickAction,
});
