// roulette.jsx — Group-spin roulette
// One wheel, one spin per round. Players place bets ON slices during a
// 5-minute window; when the window closes the wheel spins once for everyone.
// Slice types:
//   - multiplier: payout = bet × slice.multiplier
//   - dice:       single shared roll 1-6; payout = bet × roll
//   - mini-game:  each player who bet plays the chosen mini-game;
//                 win = bet × game's payout multiplier, loss = 0.

const { useState: useRS, useEffect: useRE, useRef: useRR, useMemo: useRM } = React;

// ────────────────────────────────────────────────────────────
// Helpers for slice display
// ────────────────────────────────────────────────────────────
function slicePotentialMaxMult(slice) {
  if (slice.type === 'multiplier') return slice.multiplier;
  if (slice.type === 'dice')       return 6;
  if (slice.type === 'mini-game')  return 10; // best case (Number Guess)
  if (slice.type === 'penalty')    return 0;
  return 1;
}
function slicePotentialMinMult(slice) {
  if (slice.type === 'multiplier') return slice.multiplier;
  if (slice.type === 'dice')       return 1;
  if (slice.type === 'mini-game')  return 2; // smallest mini-game payout
  if (slice.type === 'penalty')    return 0;
  return 0;
}
function slicePayoutPreview(slice, bet) {
  if (slice.type === 'multiplier') {
    const n = Math.ceil(bet * slice.multiplier);
    if (slice.multiplier === 0)    return { text: `Lose ${bet} sips`,                 mood: 'bad' };
    if (slice.multiplier < 1)      return { text: `+${n} back (partial)`,             mood: 'meh' };
    return                              { text: `+${n} sips`,                          mood: 'good' };
  }
  if (slice.type === 'dice') {
    return { text: `+${bet} to +${bet * 6} sips`, mood: 'good' };
  }
  if (slice.type === 'mini-game') {
    return { text: `Play to win 2×–10× your bet`, mood: 'good' };
  }
  if (slice.type === 'penalty') {
    return { text: `House slice — can't bet`, mood: 'bad' };
  }
  return { text: '', mood: 'meh' };
}
function sliceTileBadge(slice) {
  if (slice.type === 'multiplier') return `×${slice.multiplier}`;
  if (slice.type === 'dice')       return '🎲';
  if (slice.type === 'mini-game')  return '?';
  if (slice.type === 'penalty')    return '☠';
  return '';
}

// ────────────────────────────────────────────────────────────
// Wheel SVG (no inline ×N label per request)
// ────────────────────────────────────────────────────────────
function WheelSVG({ slices, rotation = 0, highlightId }) {
  const R = 150;
  const C = R;
  const totalWeight = slices.reduce((a, s) => a + s.weight, 0);
  let cum = 0;
  const arcs = slices.map((s) => {
    const start = (cum / totalWeight) * 360;
    cum += s.weight;
    const end = (cum / totalWeight) * 360;
    return { ...s, start, end };
  });

  const polar = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180;
    return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
  };

  return (
    <svg
      viewBox={`0 0 ${R * 2} ${R * 2}`}
      width="100%" height="100%"
      style={{
        display: 'block',
        borderRadius: '50%',
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 5.5s cubic-bezier(.18, .85, .25, 1)',
      }}>
      {arcs.map((a, i) => {
        const [x1, y1] = polar(a.start, R);
        const [x2, y2] = polar(a.end, R);
        const large = a.end - a.start > 180 ? 1 : 0;
        const path = `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
        const mid = (a.start + a.end) / 2;
        const [lx, ly] = polar(mid, R * 0.7);
        const isDim = highlightId && a.id !== highlightId;
        return (
          <g key={i}>
            <path d={path} fill={a.color}
              opacity={isDim ? 0.3 : 1}
              stroke="rgba(255, 252, 246, 0.9)" strokeWidth="1.5" />
            <g transform={`translate(${lx} ${ly}) rotate(${mid})`}>
              <text x="0" y="3" textAnchor="middle" className="wheel-slice-text">
                {a.label.toUpperCase()}
              </text>
            </g>
          </g>
        );
      })}
      {arcs.map((a, i) => {
        const [x1, y1] = polar(a.start, R - 6);
        const [x2, y2] = polar(a.start, R);
        return <line key={'t' + i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="rgba(0,0,0,0.15)" strokeWidth="1" />;
      })}
    </svg>
  );
}

function rotationToSlice(slices, idx, extraTurns = 5) {
  const totalWeight = slices.reduce((a, s) => a + s.weight, 0);
  let cum = 0;
  for (let i = 0; i < idx; i++) cum += slices[i].weight;
  const center = ((cum + slices[idx].weight / 2) / totalWeight) * 360;
  const arc = (slices[idx].weight / totalWeight) * 360;
  const jitter = (Math.random() - 0.5) * arc * 0.6;
  return (extraTurns * 360) + (360 - center + jitter);
}

function SparkleBurst({ active }) {
  const sparks = useRM(() => Array.from({ length: 26 }, (_, i) => ({
    id: i,
    tx: (Math.random() - 0.5) * 340 + 'px',
    ty: (Math.random() - 0.5) * 340 + 'px',
    color: ['#C9A961', '#E8B4B8', '#9DAE94', '#FFFCF6'][i % 4],
    delay: Math.random() * 0.2,
  })), [active]);
  if (!active) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {sparks.map((s) => (
        <div key={s.id} className="spark" style={{
          background: s.color,
          '--tx': s.tx,
          '--ty': s.ty,
          animationDelay: s.delay + 's',
        }} />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// MAIN ROULETTE SCREEN
// ────────────────────────────────────────────────────────────
function RouletteScreen({ me }) {
  const store = useStore();
  const s = store.state;
  if (!s.rouletteOpen && !s.rouletteResult) {
    return <RouletteClosed me={me} />;
  }
  return <RouletteLive me={me} key={s.rouletteRoundId} />;
}

function RouletteLive({ me }) {
  const store = useStore();
  const s = store.state;

  const [pickedSliceId, setPickedSliceId] = useRS(null);
  const [betAmount, setBetAmount] = useRS(2);
  const [rotation, setRotation] = useRS(0);
  const [spinPhase, setSpinPhase] = useRS('betting'); // betting | spinning | revealed
  const [sparks, setSparks] = useRS(false);
  const [showMyMiniGame, setShowMyMiniGame] = useRS(false);

  const result = s.rouletteResult;
  const timeLeft = store.timeToSpin();
  const bySlice = store.getRouletteBetsBySlice();
  const totalPot = s.rouletteBets.reduce((a, b) => a + b.amount, 0);
  const myBets = store.getMyRouletteBets(me.id);
  const totalWeight = s.rouletteSlices.reduce((a, b) => a + b.weight, 0);

  // Spin animation: when result first appears, start the wheel turning.
  // Track whether THIS mount has already triggered a spin to prevent replays.
  const hasSpunRef = React.useRef(false);
  useRE(() => {
    if (result && spinPhase === 'betting') {
      // Skip animation if result is already finalized or we already spun this mount
      if (result.finalized || hasSpunRef.current) {
        setSpinPhase('revealed');
        return;
      }
      hasSpunRef.current = true;
      const target = rotationToSlice(s.rouletteSlices, result.sliceIdx);
      setRotation((cur) => cur + target);
      setSpinPhase('spinning');
      setTimeout(() => {
        console.log('[UI] Animation complete — calling finalizeRouletteSpin');
        store.finalizeRouletteSpin()
          .then(() => console.log('[UI] finalizeRouletteSpin resolved'))
          .catch(e => console.error('[UI] finalizeRouletteSpin FAILED:', e));
        setSpinPhase('revealed');
        setSparks(true);
        setTimeout(() => setSparks(false), 1600);
        // If I bet on this slice AND it's a mini-game, queue the mini-game popup
        if (result.slice.type === 'mini-game') {
          const meBetHere = s.rouletteBets.some(
            (b) => b.playerId === me.id && b.sliceId === result.slice.id);
          if (meBetHere && !result.miniGameResults?.[me.id]) {
            setTimeout(() => setShowMyMiniGame(true), 1200);
          }
        }
      }, 5600);
    }
    // Reset the ref when there's no result (new round)
    if (!result) hasSpunRef.current = false;
  }, [result, spinPhase]);

  const placeBet = async () => {
    if (!pickedSliceId) return;
    const r = await store.placeRouletteBet({ playerId: me.id, sliceId: pickedSliceId, amount: betAmount });
    if (r.ok) { setPickedSliceId(null); setBetAmount(2); }
  };

  const winningId = result ? result.slice.id : null;
  const myMiniGameResult = result?.miniGameResults?.[me.id];

  return (
    <>
      <PageHead
        title="The Wheel"
        subtitle={
          spinPhase === 'betting'  ? `Round ${s.currentRound} · spins in ${fmtMSS(timeLeft)}` :
          spinPhase === 'spinning' ? 'Spinning…' :
                                     `Round ${s.currentRound} result`
        }
      />

      {/* Wheel */}
      <div style={{ padding: '8px 24px 8px', position: 'relative' }}>
        <div className="wheel-wrap" style={{ width: 280, height: 280, position: 'relative' }}>
          <div className="wheel-pointer" />
          <WheelSVG slices={s.rouletteSlices} rotation={rotation}
            highlightId={spinPhase === 'revealed' ? winningId : null} />
          <div className="wheel-hub">B</div>
          <SparkleBurst active={sparks && spinPhase === 'revealed'} />
        </div>
      </div>

      {/* Status banner */}
      {spinPhase === 'betting' && (
        <div style={{ padding: '0 24px 12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '10px 14px',
            background: s.rouletteOpen ? 'var(--paper-2)' : 'rgba(180, 98, 107, 0.08)',
            border: s.rouletteOpen ? '1px dashed var(--gold)' : '1px solid rgba(180, 98, 107, 0.25)',
            borderRadius: 'var(--r-md)',
            fontSize: 12, color: 'var(--ink-soft)',
          }}>
            {s.rouletteOpen ? (
              <>
                <Ico.Clock width={14} height={14} style={{ color: 'var(--gold-deep)' }} />
                <span>Betting closes in</span>
                <b className="num" style={{ fontSize: 16, color: 'var(--ink)' }}>{fmtMSS(timeLeft)}</b>
                <span style={{ color: 'var(--ink-mute)' }}>·</span>
                <span>{s.rouletteBets.length} bet{s.rouletteBets.length === 1 ? '' : 's'} · {totalPot} sips</span>
              </>
            ) : (
              <span style={{ color: 'var(--burgundy)', fontWeight: 600 }}>
                Betting closed — waiting for Russell to spin the wheel
              </span>
            )}
          </div>
        </div>
      )}

      {/* Result banner */}
      {spinPhase === 'revealed' && result && (
        <ResultBanner me={me} result={result} myBets={myBets} store={store}
                      onPlayMyMiniGame={() => setShowMyMiniGame(true)} />
      )}

      {/* Bet panel — only while betting window is open */}
      {spinPhase === 'betting' && s.rouletteOpen && (
        <BetPanel
          me={me}
          slices={s.rouletteSlices}
          totalWeight={totalWeight}
          bySlice={bySlice}
          pickedSliceId={pickedSliceId} setPickedSliceId={setPickedSliceId}
          betAmount={betAmount} setBetAmount={setBetAmount}
          placeBet={placeBet}
          myBets={myBets}
          store={store}
        />
      )}

      {/* After-spin: who's on what */}
      {(spinPhase === 'spinning' || spinPhase === 'revealed') && (
        <AllBetsList me={me} store={store} result={result} />
      )}

      {/* My mini-game popup */}
      <Dialog open={showMyMiniGame && spinPhase === 'revealed' && !myMiniGameResult}
        onClose={() => { /* Force-play; no dismiss */ }}>
        {result?.miniGame && (
          <MiniGameRouter
            game={{
              kind: result.miniGame,
              betAmount: myBets.filter((b) => b.sliceId === result.slice.id).reduce((a, b) => a + b.amount, 0),
            }}
            onDone={(res) => {
              store.resolvePlayerMiniGame(me.id, res.won);
              setShowMyMiniGame(false);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// BET PANEL — pick a slice during the betting window
// ────────────────────────────────────────────────────────────
function BetPanel({ me, slices, totalWeight, bySlice, pickedSliceId, setPickedSliceId, betAmount, setBetAmount, placeBet, myBets, store }) {
  const totalPot = Object.values(bySlice).reduce((a, b) => a + b.total, 0);
  const picked = pickedSliceId ? slices.find((s) => s.id === pickedSliceId) : null;
  const myBetsHere = picked ? myBets.filter((b) => b.sliceId === pickedSliceId) : [];
  const payoutPreview = picked ? slicePayoutPreview(picked, betAmount) : null;

  return (
    <div style={{ padding: '0 18px 24px' }}>
      <div className="eyebrow" style={{ marginBottom: 8, padding: '0 6px' }}>Pick a slice</div>

      <div className="stack-sm">
        {slices.map((sl) => {
          const info = bySlice[sl.id] || { total: 0, count: 0 };
          const isPicked = pickedSliceId === sl.id;
          const popPct = totalPot > 0 ? (info.total / totalPot) * 100 : 0;
          const oddsPct = totalWeight > 0 ? (sl.weight / totalWeight) * 100 : 0;
          const myBet = myBets.find((b) => b.sliceId === sl.id);
          const nonBettable = sl.type === 'penalty';
          return (
            <button key={sl.id}
              onClick={() => nonBettable ? null : setPickedSliceId(sl.id)}
              disabled={nonBettable}
              style={{
                position: 'relative', overflow: 'hidden',
                border: isPicked ? `2px solid ${sl.color}` : '1px solid var(--line-soft)',
                background: nonBettable ? 'var(--paper-2)' : 'var(--paper)',
                opacity: nonBettable ? 0.7 : 1,
                borderRadius: 'var(--r-md)',
                padding: '12px 14px',
                textAlign: 'left',
                cursor: nonBettable ? 'not-allowed' : 'pointer',
                color: 'var(--ink)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              {/* Color tile (type badge) */}
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: sl.color, color: '#FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500,
                boxShadow: 'inset 0 -2px 4px rgba(0,0,0,.18)',
                flexShrink: 0,
              }}>{sliceTileBadge(sl)}</div>

              {/* Label + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between">
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {sl.label}
                    {sl.type === 'dice' && <span style={{ color: 'var(--ink-mute)', fontSize: 11, fontWeight: 500, marginLeft: 6 }}>· 1–6× random</span>}
                    {sl.type === 'mini-game' && <span style={{ color: 'var(--ink-mute)', fontSize: 11, fontWeight: 500, marginLeft: 6 }}>· play to win</span>}
                    {sl.type === 'penalty' && <span style={{ color: 'var(--burgundy)', fontSize: 11, fontWeight: 600, marginLeft: 6 }}>· everyone drinks {sl.penaltyAmount}</span>}
                  </div>
                  <span className="num" style={{ fontSize: 11, color: 'var(--gold-deep)', fontWeight: 700 }}>
                    {oddsPct.toFixed(0)}%
                  </span>
                </div>
                <div className="row between" style={{ marginTop: 2 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }} className="num">
                    {nonBettable ? "House slice — can't bet" : `${info.count} bet${info.count === 1 ? '' : 's'} · ${info.total} sips`}
                  </div>
                </div>
                {!nonBettable && (
                  <div style={{
                    height: 4, marginTop: 6,
                    background: 'var(--paper-2)',
                    borderRadius: 99,
                    overflow: 'hidden',
                  }}>
                    <div style={{ height: '100%', width: `${popPct}%`, background: sl.color, transition: 'width .25s' }} />
                  </div>
                )}
              </div>

              {myBet && (
                <div className="pill pill-blush" style={{ flexShrink: 0 }}>You · {myBet.amount}</div>
              )}
              {isPicked && <Ico.Check width={20} height={20} style={{ color: sl.color, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {picked && (
        <div style={{
          marginTop: 14,
          padding: 16,
          background: 'var(--paper-2)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--r-md)',
        }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{picked.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                {(picked.weight / totalWeight * 100).toFixed(0)}% chance to land · You have <b className="num" style={{ color: 'var(--ink)' }}>{me.balance}</b> sips
              </div>
            </div>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: picked.color, color: '#FFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 22,
            }}>{sliceTileBadge(picked)}</div>
          </div>

          <Stepper value={betAmount} onChange={setBetAmount} min={1} max={me.balance} />

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }}>
            If it lands: <b style={{ color: payoutPreview.mood === 'bad' ? 'var(--bad)' : 'var(--gold-deep)' }}>{payoutPreview.text}</b>
            {' · '}
            <span>{me.balance - betAmount} left if you bet</span>
          </div>

          <button
            disabled={betAmount > me.balance}
            onClick={placeBet}
            className="btn btn-gold btn-block"
            style={{ marginTop: 12 }}>
            Place {betAmount} sip{betAmount === 1 ? '' : 's'} on {picked.label}
          </button>

          {myBetsHere.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center' }}>
              You've already put {myBetsHere.reduce((a, b) => a + b.amount, 0)} sips here this round
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// AllBetsList — who's on what (used during spin + revealed)
// ────────────────────────────────────────────────────────────
function AllBetsList({ me, store, result }) {
  const s = store.state;
  return (
    <div style={{ padding: '4px 18px 24px' }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>All bets</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {s.rouletteSlices.map((sl) => {
          const bets = s.rouletteBets.filter((b) => b.sliceId === sl.id);
          if (bets.length === 0) return null;
          const isWinner = result && sl.id === result.slice.id;
          return (
            <div key={sl.id} style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--line-soft)',
              background: isWinner ? 'var(--gold-faint)' : 'transparent',
            }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: sl.color }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{sl.label}</span>
                  <span className="pill pill-line" style={{ fontSize: 10, padding: '2px 8px' }}>
                    {sliceTileBadge(sl)}
                  </span>
                  {isWinner && <span className="pill pill-gold" style={{ fontSize: 10, padding: '2px 8px' }}>WINNER</span>}
                </div>
                <span className="num" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  {bets.reduce((a, b) => a + b.amount, 0)} sips
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {bets.map((b) => {
                  const p = store.getPlayer(b.playerId);
                  const isMe = b.playerId === me.id;
                  const mgRes = result?.miniGameResults?.[b.playerId];
                  return (
                    <div key={b.id} className="row" style={{
                      gap: 4, padding: '2px 8px 2px 2px',
                      background: isMe ? 'var(--blush-soft)' : 'var(--paper-2)',
                      borderRadius: 999, fontSize: 11,
                    }}>
                      <Avatar player={p} size="sm" />
                      <span>{isMe ? 'you' : p?.firstName}</span>
                      <span className="num" style={{ fontWeight: 700 }}>{b.amount}</span>
                      {mgRes && (
                        <span style={{
                          marginLeft: 2,
                          color: mgRes.won ? 'var(--sage-deep)' : 'var(--bad)',
                          fontWeight: 700,
                        }}>{mgRes.won ? `+${mgRes.payout}` : '×'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Result banner
// ────────────────────────────────────────────────────────────
function ResultBanner({ me, result, myBets, store, onPlayMyMiniGame }) {
  const slice = result.slice;
  const winners = result.winners || [];
  const myWin   = winners.find((w) => w.playerId === me.id);
  const myBet   = myBets.find((b) => b.sliceId === slice.id);
  const myLossTotal = myBets
    .filter((b) => b.sliceId !== slice.id)
    .reduce((a, b) => a + b.amount, 0);
  const net = (myWin?.payout || 0) - (myBet?.amount || 0) - myLossTotal;

  const isMiniGame = slice.type === 'mini-game';
  const isDice     = slice.type === 'dice';
  const isPenalty  = slice.type === 'penalty';
  const myMiniRes  = result.miniGameResults?.[me.id];
  const meBetMiniGame = isMiniGame && !!myBet;
  const pendingCount  = result.pendingPlayers?.length || 0;

  return (
    <div style={{ padding: '4px 18px 14px' }}>
      <div style={{
        padding: 16,
        background: `linear-gradient(135deg, ${slice.color} 0%, color-mix(in oklch, ${slice.color} 65%, black) 100%)`,
        color: '#FFF',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div className="row between">
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              opacity: 0.85,
            }}>The wheel landed on</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1, marginTop: 4 }}>
              {slice.label}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
              {slice.type === 'multiplier' && <>×{slice.multiplier} multiplier · {winners.length} winner{winners.length === 1 ? '' : 's'}</>}
              {isDice && <>Dice rolled <b style={{ fontSize: 18 }}>{result.dieValue}</b> · ×{result.dieValue} for all who bet</>}
              {isMiniGame && <>Everyone who bet plays <b>{result.miniGame}</b></>}
              {isPenalty && <>Drink <b style={{ fontSize: 18 }}>{slice.penaltyAmount} sip{slice.penaltyAmount === 1 ? '' : 's'}</b> IRL — everyone gets +{slice.penaltyAmount}</>}
            </div>
          </div>
          {!isMiniGame && !isPenalty ? (
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1,
              color: net > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
            }}>
              {net > 0 ? `+${net}` : net < 0 ? `${net}` : '±0'}
            </div>
          ) : isPenalty ? (
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1,
              color: 'rgba(255,255,255,0.95)',
            }}>+{slice.penaltyAmount}</div>
          ) : isDice ? null : (
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 26,
            }}>?</div>
          )}
        </div>

        {/* Penalty body */}
        {isPenalty && myBets.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
            You bet {myBets.reduce((a, b) => a + b.amount, 0)} sips elsewhere — those are gone, but +{slice.penaltyAmount} from the penalty.
          </div>
        )}
        {isPenalty && myBets.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95, fontStyle: 'italic' }}>
            Free +{slice.penaltyAmount} for you. Drink up.
          </div>
        )}

        {/* Per-state body lines */}
        {!isMiniGame && !isPenalty && myBets.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, fontStyle: 'italic' }}>
            You sat this one out.
          </div>
        )}
        {!isMiniGame && !isPenalty && myWin && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
            You bet <b>{myBet.amount}</b> on {slice.label} → won <b>{myWin.payout}</b> sips
          </div>
        )}
        {!isMiniGame && !isPenalty && !myWin && myBets.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            Lost {myLossTotal} sips. Next round in a bit.
          </div>
        )}

        {/* Mini-game body */}
        {isMiniGame && meBetMiniGame && !myMiniRes && (
          <button
            onClick={onPlayMyMiniGame}
            style={{
              marginTop: 14,
              width: '100%', padding: '12px',
              background: 'rgba(255,255,255,0.95)',
              color: slice.color, border: 0, borderRadius: 8,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              letterSpacing: '0.04em',
            }}>
            Play {result.miniGame} now →
          </button>
        )}
        {isMiniGame && myMiniRes && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
            {myMiniRes.won
              ? <>You won the mini-game! <b>+{myMiniRes.payout}</b> sips</>
              : <>You lost the mini-game — {myMiniRes.betAmount} sips gone</>}
          </div>
        )}
        {isMiniGame && !meBetMiniGame && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            {pendingCount > 0
              ? <>{pendingCount} player{pendingCount === 1 ? '' : 's'} still playing…</>
              : <>All mini-games resolved.</>}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CLOSED STATE — between rounds
// ────────────────────────────────────────────────────────────
function RouletteClosed({ me }) {
  const store = useStore();
  const wait = store.timeToNextRound();
  const history = store.state.rouletteHistory.slice(0, 3);
  return (
    <>
      <PageHead title="The Wheel" subtitle="Closed" />
      <div style={{
        flex: 1, padding: '36px 28px 24px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <Laurel size={72} color="var(--gold-deep)" />
        <div className="eyebrow gold" style={{ marginTop: 14 }}>Next spin in</div>
        <div style={{
          marginTop: 8, fontFamily: 'var(--font-mono)',
          fontSize: 56, fontWeight: 500, color: 'var(--ink)',
          letterSpacing: '-0.02em',
        }}>{fmtMSS(wait)}</div>
        <div style={{ marginTop: 6, color: 'var(--ink-mute)', fontSize: 13, maxWidth: 280 }}>
          Wheel opens for 5 minutes of betting at the start of every round, then spins once.
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 28, width: '100%', maxWidth: 300 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Last rounds</div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {history.map((h, i) => (
                <div key={i} className="row between" style={{
                  padding: '10px 14px',
                  borderBottom: i === history.length - 1 ? 0 : '1px solid var(--line-soft)',
                }}>
                  <span style={{ fontWeight: 600 }}>{h.label}</span>
                  <span className="pill pill-line">{typeof h.multiplier === 'number' ? `×${h.multiplier}` : h.multiplier}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// MINI-GAMES — opened when wheel lands on Mini-Game slice
// ════════════════════════════════════════════════════════════
function MiniGameRouter({ game, onDone }) {
  if (game.kind === 'numberGuess')  return <MGNumberGuess  onDone={onDone} bet={game.betAmount} />;
  if (game.kind === 'coinFlip')     return <MGCoinFlip     onDone={onDone} bet={game.betAmount} />;
  if (game.kind === 'higherLower')  return <MGHigherLower  onDone={onDone} bet={game.betAmount} />;
  if (game.kind === 'shotRoulette') return <MGShotRoulette onDone={onDone} bet={game.betAmount} />;
  if (game.kind === 'dareOrDrink')  return <MGDare         onDone={onDone} bet={game.betAmount} />;
  return null;
}

function MGShell({ title, sub, children }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="eyebrow gold" style={{ marginBottom: 4 }}>Mini-game</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--ink)', lineHeight: 1.1 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 6 }}>{sub}</div>}
      <Ornament glyph="✦" />
      {children}
    </div>
  );
}

function MGNumberGuess({ onDone, bet }) {
  const [picked, setP] = useRS(null);
  const [actual, setA] = useRS(null);
  const reveal = (n) => {
    setP(n);
    const real = 1 + Math.floor(Math.random() * 10);
    setA(real);
    setTimeout(() => onDone({ won: n === real }), 1400);
  };
  return (
    <MGShell title="Number Guess" sub="Pick 1–10. Correct = 10× your bet.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, margin: '18px 0' }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const isPicked = picked === n;
          const isActual = actual === n;
          return (
            <button key={n}
              onClick={() => picked == null && reveal(n)}
              disabled={picked != null}
              style={{
                aspectRatio: '1',
                background: isActual ? 'var(--sage-deep)' :
                            isPicked ? 'var(--blush-deep)' :
                            'var(--paper-2)',
                color: (isActual || isPicked) ? '#FFF' : 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                fontFamily: 'var(--font-display)', fontSize: 22,
                cursor: picked == null ? 'pointer' : 'default',
              }}>{n}</button>
          );
        })}
      </div>
      {picked && actual && (
        <div style={{ fontSize: 14, color: picked === actual ? 'var(--sage-deep)' : 'var(--bad)' }}>
          {picked === actual ? `Bang on! +${bet * 10} sips` : `It was ${actual}. So close.`}
        </div>
      )}
    </MGShell>
  );
}

function MGCoinFlip({ onDone, bet }) {
  const [picked, setP] = useRS(null);
  const [flipping, setF] = useRS(false);
  const [result, setR] = useRS(null);
  const flip = (side) => {
    setP(side);
    setF(true);
    setTimeout(() => {
      const real = Math.random() < 0.5 ? 'heads' : 'tails';
      setR(real); setF(false);
      setTimeout(() => onDone({ won: side === real }), 1100);
    }, 1300);
  };
  return (
    <MGShell title="Coin Flip" sub="Heads or tails. Double or nothing.">
      <div style={{
        margin: '24px auto', width: 110, height: 110, borderRadius: '50%',
        background: 'linear-gradient(140deg, var(--gold-soft), var(--gold-deep))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 36, color: '#FFF',
        boxShadow: 'var(--shadow-md)',
        animation: flipping ? 'coinFlip 1.3s ease-out' : 'none',
      }}>{result ? (result === 'heads' ? 'H' : 'T') : '?'}</div>
      <style>{`@keyframes coinFlip { 0%{transform:rotateY(0)} 100%{transform:rotateY(1440deg)} }`}</style>
      {!picked && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => flip('heads')} className="btn btn-gold"  style={{ flex: 1 }}>Heads</button>
          <button onClick={() => flip('tails')} className="btn btn-ghost" style={{ flex: 1 }}>Tails</button>
        </div>
      )}
      {picked && !result && <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Flipping… you called <b>{picked}</b></div>}
      {result && <div style={{ fontSize: 14, color: picked === result ? 'var(--sage-deep)' : 'var(--bad)' }}>
        {result}! {picked === result ? `+${bet * 2} sips` : `Bad luck`}
      </div>}
    </MGShell>
  );
}

function MGHigherLower({ onDone, bet }) {
  const [base] = useRS(() => 1 + Math.floor(Math.random() * 100));
  const [picked, setP] = useRS(null);
  const [next, setN] = useRS(null);
  const guess = (dir) => {
    setP(dir);
    let n; do { n = 1 + Math.floor(Math.random() * 100); } while (n === base);
    setN(n);
    const won = dir === 'higher' ? n > base : n < base;
    setTimeout(() => onDone({ won }), 1300);
  };
  return (
    <MGShell title="Higher or Lower" sub="Will the next number be higher or lower?">
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, margin: '20px 0' }}>
        <NumberCard n={base} small />
        <div style={{ alignSelf: 'center', fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-mute)' }}>→</div>
        <NumberCard n={next} highlight={next != null && (picked === 'higher' ? next > base : next < base)} small />
      </div>
      {!picked && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => guess('lower')}  className="btn btn-ghost" style={{ flex: 1 }}>↓ Lower</button>
          <button onClick={() => guess('higher')} className="btn btn-gold"  style={{ flex: 1 }}>Higher ↑</button>
        </div>
      )}
      {picked && next != null && (
        <div style={{ fontSize: 14, marginTop: 4 }}>
          <b>{next}</b> {next > base ? 'is higher' : 'is lower'}.
        </div>
      )}
    </MGShell>
  );
}
function NumberCard({ n, highlight, small }) {
  return (
    <div style={{
      width: small ? 70 : 90, height: small ? 70 : 90,
      borderRadius: 14,
      background: highlight === true ? 'var(--sage-soft)' : highlight === false ? 'var(--blush-soft)' : 'var(--paper-2)',
      border: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: small ? 38 : 50,
      color: highlight === false ? 'var(--burgundy)' : 'var(--ink)',
    }}>{n != null ? n : '?'}</div>
  );
}

function MGShotRoulette({ onDone, bet }) {
  const [picked, setP] = useRS(null);
  const [poison] = useRS(() => Math.floor(Math.random() * 6));
  const pick = (i) => {
    setP(i);
    setTimeout(() => onDone({ won: i !== poison }), 1300);
  };
  return (
    <MGShell title="Shot Roulette" sub="One of these is poison. Pick a glass.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '16px 0' }}>
        {Array.from({ length: 6 }, (_, i) => {
          const revealed = picked != null;
          const isPoison = revealed && i === poison;
          const isPicked = i === picked;
          return (
            <button key={i}
              onClick={() => picked == null && pick(i)}
              disabled={picked != null}
              style={{
                aspectRatio: '0.8',
                background: isPoison ? 'var(--burgundy)' : isPicked ? 'var(--sage-deep)' : 'var(--paper-2)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                cursor: picked == null ? 'pointer' : 'default',
                color: (isPoison || isPicked) ? '#FFF' : 'var(--ink-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4h10l-1 14a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3L7 4z" />
                {isPoison && <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9" fontWeight="700">!</text>}
              </svg>
            </button>
          );
        })}
      </div>
      {picked != null && (
        <div style={{ fontSize: 14, color: picked === poison ? 'var(--bad)' : 'var(--sage-deep)' }}>
          {picked === poison ? `Poisoned! Lost ${bet} sips.` : `Safe! +${bet * 2} sips`}
        </div>
      )}
    </MGShell>
  );
}

const DARES = [
  "Convince a stranger to do a shot with you.",
  "Sing the chorus of Eagle Rock to Russell.",
  "Compliment 3 outfits in the next 60 seconds.",
  "Bow to the bride and address her as 'Your Highness' all night.",
  "Steal a flower from the centerpiece and wear it.",
  "Find Kyle and recite his vows back to him.",
  "Attempt the Macarena. Solo.",
];
function MGDare({ onDone, bet }) {
  const [dare] = useRS(() => DARES[Math.floor(Math.random() * DARES.length)]);
  const [decision, setD] = useRS(null);
  const done = (did) => {
    setD(did);
    setTimeout(() => onDone({ won: did }), 1300);
  };
  return (
    <MGShell title="Dare or Drink" sub="Pull it off, win 5×. Chicken out, lose your bet.">
      <div style={{
        margin: '18px 0',
        padding: '20px 18px',
        background: 'var(--paper-2)',
        border: '1px dashed var(--gold)',
        borderRadius: 14,
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 20, color: 'var(--ink)', lineHeight: 1.3,
      }}>"{dare}"</div>
      {decision == null ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => done(false)} className="btn btn-ghost" style={{ flex: 1 }}>Chicken out</button>
          <button onClick={() => done(true)}  className="btn btn-gold"  style={{ flex: 1 }}>Done it!</button>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: decision ? 'var(--sage-deep)' : 'var(--bad)' }}>
          {decision ? `Legend. +${bet * 5} sips` : `Coward. ${bet} sips gone.`}
        </div>
      )}
    </MGShell>
  );
}

Object.assign(window, { RouletteScreen, WheelSVG, SparkleBurst, MiniGameRouter });
