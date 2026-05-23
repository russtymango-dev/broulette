// store.jsx — Broulette shared in-memory game state
//
// Sips economy:
//   - The in-game currency is SIPS.
//   - 1 sip credit = 1 actual sip IRL.
//   - 10 sips = 1 whole drink (just a useful conversion to talk about).
//
// Earning sips:
//   - AUTO: every 30 min, everyone gets +5 sips automatically.
//   - BUY MORE: optionally request up to 5 EXTRA sips per round
//     (you drink IRL, Russell approves). On top of the auto +5.
//
// Roulette (group spin):
//   - ONE shared spin per 30-min round.
//   - 5-minute betting window after the round starts.
//   - Players bet sips on individual slices.
//   - Wheel spins ONCE. Winning slice pays out (amount × slice.multiplier).
//   - Everyone who bet on a losing slice loses their bet.

// ────────────────────────────────────────────────────────────
// Sample players — start the demo mid-round so there's energy
// ────────────────────────────────────────────────────────────

const SAMPLE_PLAYERS = [
  { id: 'p_russell', firstName: 'Russell', lastInitial: 'W', pin: '787789', balance: 11, isAdmin: true,  avatar: 'ink',   joinedRound: 0 },
  { id: 'p_izzy',    firstName: 'Izzy',    lastInitial: 'M', pin: '052326', balance: 18, isAdmin: false, avatar: 'blush', joinedRound: 0 },
  { id: 'p_kyle',    firstName: 'Kyle',    lastInitial: 'T', pin: '052326', balance: 6,  isAdmin: false, avatar: 'gold',  joinedRound: 0 },
  { id: 'p_steph',   firstName: 'Steph',   lastInitial: 'H', pin: '444444', balance: 14, isAdmin: false, avatar: 'sage',  joinedRound: 0 },
  { id: 'p_jonno',   firstName: 'Jonno',   lastInitial: 'B', pin: '111000', balance: 2,  isAdmin: false, avatar: 'burg',  joinedRound: 0 },
  { id: 'p_aunt',    firstName: 'Aunty',   lastInitial: 'P', pin: '111111', balance: 9,  isAdmin: false, avatar: 'blush', joinedRound: 0 },
  { id: 'p_dave',    firstName: 'Uncle',   lastInitial: 'D', pin: '777777', balance: 22, isAdmin: false, avatar: 'gold',  joinedRound: 0 },
  { id: 'p_mel',     firstName: 'Mel',     lastInitial: 'C', pin: '222222', balance: 12, isAdmin: false, avatar: 'sage',  joinedRound: 0 },
  { id: 'p_groomsman', firstName: 'Tom',  lastInitial: 'R', pin: '333333', balance: 4,  isAdmin: false, avatar: 'burg',   joinedRound: 0 },
];

const SAMPLE_BETS = [
  {
    id: 'b_speech',
    createdBy: 'p_jonno',
    proposition: "Father of the bride cries during his speech",
    status: 'open',
    _vtime_created: -1800,
    _vtime_expires: 1800,
    totalFor: 11, totalAgainst: 4,
    wagers: [
      { id: 'w1', playerId: 'p_izzy',  side: 'for',     amount: 3 },
      { id: 'w2', playerId: 'p_aunt',  side: 'for',     amount: 4 },
      { id: 'w3', playerId: 'p_steph', side: 'for',     amount: 2 },
      { id: 'w4', playerId: 'p_mel',   side: 'for',     amount: 2 },
      { id: 'w5', playerId: 'p_kyle',  side: 'against', amount: 1 },
      { id: 'w6', playerId: 'p_dave',  side: 'against', amount: 3 },
    ],
  },
  {
    id: 'b_cake',
    createdBy: 'p_steph',
    proposition: "Kyle smashes cake into Izzy's face (he was warned)",
    status: 'open',
    _vtime_created: -1200,
    _vtime_expires: 2400,
    totalFor: 3, totalAgainst: 9,
    wagers: [
      { id: 'w7',  playerId: 'p_kyle',     side: 'against', amount: 5 },
      { id: 'w8',  playerId: 'p_groomsman',side: 'for',     amount: 2 },
      { id: 'w9',  playerId: 'p_jonno',    side: 'for',     amount: 1 },
      { id: 'w10', playerId: 'p_aunt',     side: 'against', amount: 2 },
      { id: 'w11', playerId: 'p_dave',     side: 'against', amount: 2 },
    ],
  },
  {
    id: 'b_first',
    createdBy: 'p_dave',
    proposition: "First dance gets cut short by someone DJ'ing over it",
    status: 'pending_approval',
    _vtime_created: -300,
    _vtime_expires: 3300,
    totalFor: 0, totalAgainst: 0,
    wagers: [],
  },
  {
    id: 'b_shoes',
    createdBy: 'p_izzy',
    proposition: "Izzy ditches her heels before 8pm",
    status: 'resolved_won',
    _vtime_created: -3600,
    _vtime_expires: -1800,
    _vtime_resolved: -1500,
    totalFor: 7, totalAgainst: 5,
    wagers: [
      { id: 'w12', playerId: 'p_izzy',  side: 'for',     amount: 2, payout: 4 },
      { id: 'w13', playerId: 'p_mel',   side: 'for',     amount: 5, payout: 9 },
      { id: 'w14', playerId: 'p_jonno', side: 'against', amount: 5, payout: 0 },
    ],
  },
];

// ────────────────────────────────────────────────────────────
// Wheel slices — types: multiplier | dice | mini-game
// ────────────────────────────────────────────────────────────
const DEFAULT_SLICES = [
  { id: 's1', label: 'Cheers',     type: 'multiplier', multiplier: 2,    weight: 5, color: '#C9A961' },
  { id: 's2', label: 'Skulls',     type: 'penalty',    penaltyAmount: 2, weight: 5, color: '#7A2E3A' },
  { id: 's3', label: 'Sip Back',   type: 'multiplier', multiplier: 1.5,  weight: 3, color: '#9DAE94' },
  { id: 's4', label: 'Triple',     type: 'multiplier', multiplier: 3,    weight: 2, color: '#C97D85' },
  { id: 's5', label: 'JACKPOT',    type: 'multiplier', multiplier: 5,    weight: 1, color: '#9C7E3D' },
  { id: 's6', label: 'Dice',       type: 'dice',                         weight: 2, color: '#5E4A3E' },
  { id: 's7', label: 'Mini-Game',  type: 'mini-game',                    weight: 2, color: '#B4626B' },
];

// ────────────────────────────────────────────────────────────
// Demo state — game is 30 min in. Round 2 JUST started, full 5 min
//   betting window ahead.
// ────────────────────────────────────────────────────────────
const GAME_START_VTIME = -31 * 60;       // started 31 min ago; round 2 began 1 min ago
const ROUND_LEN        = 30 * 60;        // 30 min
const BET_WINDOW_LEN   = 5 * 60;         // 5 min betting window

const INITIAL_ROUND = 2;
const INITIAL_ROULETTE_BETS = [
  { id: 'rb1', playerId: 'p_izzy',  sliceId: 's1', amount: 3 },
  { id: 'rb2', playerId: 'p_dave',  sliceId: 's5', amount: 4 },
  { id: 'rb3', playerId: 'p_mel',   sliceId: 's6', amount: 2 },
  { id: 'rb4', playerId: 'p_aunt',  sliceId: 's3', amount: 2 },
  { id: 'rb5', playerId: 'p_groomsman', sliceId: 's4', amount: 1 },
];

const SAMPLE_SIP_REQUESTS = [
  { id: 'sr1', playerId: 'p_jonno', amount: 3, status: 'pending', requestedAt: -120 },
  { id: 'sr2', playerId: 'p_aunt',  amount: 2, status: 'pending', requestedAt: -45 },
];

const SAMPLE_ACTIVITY = [
  { id: 'a1',  type: 'round_start',  message: 'Round 2 began — wheel betting is OPEN for 5 minutes',                                _vtime: -60 },
  { id: 'a2',  type: 'credit_drop',  message: 'Round 2 — everyone got +5 sips automatically',                                       _vtime: -60 },
  { id: 'a3',  type: 'transfer',     message: 'Russell W sent 2 sips to Izzy M',                                                    _vtime: -45, data: { fromId: 'p_russell', toId: 'p_izzy', amount: 2 } },
  { id: 'a4',  type: 'sips_approved',message: 'Russell approved +5 sips for Mel C',                                                _vtime: -160 },
  { id: 'a5',  type: 'transfer',     message: 'Steph H sent 4 sips to Russell W',                                                  _vtime: -30, data: { fromId: 'p_steph', toId: 'p_russell', amount: 4 } },
  { id: 'a6',  type: 'bet_resolved', message: '"Izzy ditches her heels before 8pm" resolved — YES won',                            _vtime: -1500 },
  { id: 'a7',  type: 'roulette_result', message: 'Round 1: wheel landed on TRIPLE — 9 sips paid out',                              _vtime: -1620 },
  { id: 'a8',  type: 'bet_created',  message: 'New bet: "Kyle smashes cake into Izzy\'s face"',                                    _vtime: -1700 },
  { id: 'a9',  type: 'sips_approved',message: 'Russell approved +4 sips for Uncle D',                                              _vtime: -1750 },
  { id: 'a10', type: 'transfer',     message: 'Aunty P sent 3 sips to Izzy M',                                                     _vtime: -50, data: { fromId: 'p_aunt', toId: 'p_izzy', amount: 3 } },
  { id: 'a11', type: 'round_start',  message: 'Round 1 began — first wheel spin window open',                                      _vtime: -1920 },
  { id: 'a12', type: 'game_start',   message: 'Broulette is live! Welcome to Izzy & Kyle\'s wedding 🥂',                          _vtime: GAME_START_VTIME },
];

// ────────────────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────────────────

function makeStore() {
  let listeners = new Set();
  let _id = 1000;
  const nextId = (p) => `${p}_${++_id}`;

  // Per-player toast queues
  const playerToasts = {};

  const state = {
    gameStartedAtVirtual: GAME_START_VTIME,
    roundLen: ROUND_LEN,
    autoSipsPerRound: 5,        // automatic drop each round
    extraSipsMax: 5,            // extra you can buy from Russell each round
    currentRound: INITIAL_ROUND,
    nowVirtual: 0,
    gameStatus: 'active',       // waiting | active | paused | ended
    speed: 1,

    // Sign-up queue — anyone can apply, Russell approves
    registrationRequests: [
      { id: 'rr_demo1', firstName: 'Sam', lastInitial: 'K', pin: '901234', status: 'pending', requestedAt: -60 },
      { id: 'rr_demo2', firstName: 'Bec', lastInitial: 'J', pin: '550100', status: 'pending', requestedAt: -25 },
    ],

    // Players currently signed in on a phone (not bots) — used to decide who
    // auto-resolves their mini-game when the wheel lands on Mini-Game.
    livePlayerIds: new Set(),

    players: SAMPLE_PLAYERS.map((p) => ({ ...p })),
    bets: SAMPLE_BETS.map((b) => ({ ...b, wagers: [...b.wagers] })),
    activity: SAMPLE_ACTIVITY.map((a) => ({ ...a })),
    sipRequests: SAMPLE_SIP_REQUESTS.map((r) => ({ ...r })),

    // Per-player sips already approved THIS round (resets each round)
    sipsThisRound: {},

    // Roulette
    rouletteSlices: [...DEFAULT_SLICES],
    rouletteDisabled: false,
    rouletteOpen: true,                                            // betting window
    rouletteRoundId: 'rr_round2',
    rouletteBetsCloseAt: GAME_START_VTIME + 1 * ROUND_LEN + BET_WINDOW_LEN, // -32min + 30min + 5min = +3min
    rouletteSpinning: false,
    rouletteResult: null,        // { sliceIdx, slice, winners: [...], totalPot }
    rouletteBets: INITIAL_ROULETTE_BETS.map((b) => ({ ...b })),
    rouletteHistory: [
      // Round 1's outcome — already happened
      { roundId: 'rr_round1', sliceId: 's4', label: 'Triple', multiplier: 3 },
    ],
  };

  // Deduct existing bets from balances so totals reconcile
  for (const b of state.rouletteBets) {
    const p = state.players.find((p) => p.id === b.playerId);
    if (p) p.balance -= b.amount;
  }
  for (const b of state.bets) {
    for (const w of b.wagers) {
      if (b.status === 'open' || b.status === 'pending_approval') {
        const p = state.players.find((p) => p.id === w.playerId);
        if (p) p.balance -= w.amount;
      }
    }
  }

  // ── Subscriptions ────────────────────────────────────────
  const notify = () => { for (const fn of listeners) fn(); };
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const setState = (patch) => {
    Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
    notify();
  };

  // ── Virtual clock ────────────────────────────────────────
  let wallStart = Date.now();
  let virtualStart = 0;
  let speed = 1;

  const computeVirtualNow = () => {
    const elapsedReal = (Date.now() - wallStart) / 1000;
    return virtualStart + elapsedReal * speed;
  };
  const setSpeed = (s) => {
    virtualStart = computeVirtualNow();
    wallStart = Date.now();
    speed = s;
    state.speed = s;
    notify();
  };

  // ── Tick: round transitions + roulette resolution ────────
  setInterval(() => {
    const v = computeVirtualNow();
    state.nowVirtual = v;

    const elapsedSinceStart = v - state.gameStartedAtVirtual;
    const expectedRound = Math.floor(elapsedSinceStart / ROUND_LEN) + 1;

    if (expectedRound > state.currentRound && state.gameStatus === 'active') {
      startNewRound(expectedRound);
    }

    // Roulette spin trigger
    if (state.rouletteOpen && !state.rouletteSpinning && !state.rouletteResult
        && v >= state.rouletteBetsCloseAt) {
      executeRouletteSpin();
    }

    notify();
  }, 250);

  // ── Activity log ─────────────────────────────────────────
  const log = (type, message, data = {}) => {
    state.activity.unshift({
      id: nextId('a'),
      type, message,
      playerId: data.playerId || null,
      data,
      _vtime: state.nowVirtual,
    });
    if (state.activity.length > 200) state.activity.length = 200;
  };

  // ── Toasts ───────────────────────────────────────────────
  const pushToastTo = (playerId, t) => {
    if (!playerToasts[playerId]) playerToasts[playerId] = [];
    playerToasts[playerId].push({ ...t, id: nextId('t'), at: Date.now() });
    notify();
  };
  const drainToasts = (playerId) => {
    const list = playerToasts[playerId] || [];
    playerToasts[playerId] = [];
    return list;
  };

  // ── Round transitions ────────────────────────────────────
  function startNewRound(roundNum) {
    state.currentRound = roundNum;
    state.sipsThisRound = {};       // reset the per-round extra-sip quota

    // Automatic credit drop
    for (const p of state.players) {
      if (roundNum >= p.joinedRound) {
        p.balance += state.autoSipsPerRound;
        pushToastTo(p.id, { icon: '+', text: `+${state.autoSipsPerRound} sips dropped (Round ${roundNum})` });
      }
    }
    log('credit_drop', `Round ${roundNum} — everyone got +${state.autoSipsPerRound} sips automatically`);

    // Open new roulette betting window
    state.rouletteOpen = true;
    state.rouletteSpinning = false;
    state.rouletteResult = null;
    state.rouletteRoundId = nextId('rr');
    state.rouletteBets = [];
    state.rouletteBetsCloseAt =
      state.gameStartedAtVirtual + (roundNum - 1) * ROUND_LEN + BET_WINDOW_LEN;
    log('round_start',
      `Wheel betting is open for 5 minutes — place your bets`);
  }

  // ── Auth ─────────────────────────────────────────────────
  function addPlayer(args) {
    // Legacy alias — sign-ups now go through Russell.
    return requestRegistration(args);
  }
  function requestRegistration({ firstName, lastInitial, pin }) {
    const dup = state.players.find((x) =>
      x.firstName.toLowerCase() === firstName.toLowerCase() &&
      x.lastInitial.toLowerCase() === lastInitial.toLowerCase());
    if (dup) return { error: 'That name is taken — try a different last initial.' };
    const existing = state.registrationRequests.find((r) =>
      r.status === 'pending' &&
      r.firstName.toLowerCase() === firstName.toLowerCase() &&
      r.lastInitial.toLowerCase() === lastInitial.toLowerCase());
    if (existing) return { ok: true, request: existing, duplicate: true };
    const req = {
      id: nextId('rrq'),
      firstName, lastInitial, pin,
      status: 'pending',
      requestedAt: state.nowVirtual,
    };
    state.registrationRequests.unshift(req);
    log('signup_requested', `${firstName} ${lastInitial} wants to join the game`);
    notify();
    return { ok: true, request: req };
  }
  function approveRegistration(reqId) {
    const r = state.registrationRequests.find((x) => x.id === reqId);
    if (!r || r.status !== 'pending') return;
    const dup = state.players.find((x) =>
      x.firstName.toLowerCase() === r.firstName.toLowerCase() &&
      x.lastInitial.toLowerCase() === r.lastInitial.toLowerCase());
    if (dup) { r.status = 'rejected'; r.resolvedAt = state.nowVirtual; notify(); return; }
    const player = {
      id: nextId('p'),
      firstName: r.firstName,
      lastInitial: r.lastInitial,
      pin: r.pin,
      balance: 0,
      isAdmin: false,
      avatar: ['blush','gold','sage','burg'][state.players.length % 4],
      joinedRound: state.currentRound,
    };
    state.players.push(player);
    r.status = 'approved';
    r.resolvedAt = state.nowVirtual;
    r.playerId = player.id;
    log('player_joined', `${player.firstName} ${player.lastInitial} joined (approved by Russell)`);
    notify();
  }
  function rejectRegistration(reqId) {
    const r = state.registrationRequests.find((x) => x.id === reqId);
    if (!r || r.status !== 'pending') return;
    r.status = 'rejected';
    r.resolvedAt = state.nowVirtual;
    log('signup_rejected', `Russell declined a sign-up from ${r.firstName} ${r.lastInitial}`);
    notify();
  }
  function findPlayerByName(firstName, lastInitial) {
    return state.players.find((p) =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase()
    ) || null;
  }
  function tryLogin({ firstName, lastInitial, pin }) {
    return state.players.find((p) =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase() &&
      p.pin === pin
    ) || null;
  }

  // ── Extra sip requests (additional on top of the auto drop) ──
  function sipsRequestedThisRound(playerId) {
    return state.sipsThisRound[playerId] || 0;
  }
  function sipsRemainingThisRound(playerId) {
    return Math.max(0, state.extraSipsMax - sipsRequestedThisRound(playerId));
  }
  function requestSips({ playerId, amount }) {
    const p = state.players.find((p) => p.id === playerId);
    if (!p) return { error: 'No player' };
    const remaining = sipsRemainingThisRound(playerId);
    if (amount > remaining) return { error: `Only ${remaining} extra sip${remaining===1?'':'s'} left this round` };
    if (amount < 1) return { error: 'Must request at least 1 sip' };
    // Reserve quota now so they can't double-request before approval
    state.sipsThisRound[playerId] = (state.sipsThisRound[playerId] || 0) + amount;
    state.sipRequests.unshift({
      id: nextId('sr'),
      playerId,
      amount,
      status: 'pending',
      requestedAt: state.nowVirtual,
    });
    log('sips_requested', `${p.firstName} ${p.lastInitial} asked Russell for ${amount} extra sip${amount===1?'':'s'}`, { playerId });
    pushToastTo(playerId, { icon: '⏳', text: 'Sent to Russell for approval' });
    notify();
    return { ok: true };
  }
  function approveSipRequest(reqId) {
    const r = state.sipRequests.find((x) => x.id === reqId);
    if (!r || r.status !== 'pending') return;
    r.status = 'approved';
    r.resolvedAt = state.nowVirtual;
    const p = state.players.find((p) => p.id === r.playerId);
    if (p) {
      p.balance += r.amount;
      pushToastTo(p.id, { icon: '🥂', text: `Russell approved +${r.amount} sip${r.amount===1?'':'s'}` });
    }
    log('sips_approved', `Russell approved +${r.amount} sip${r.amount===1?'':'s'} for ${p?.firstName} ${p?.lastInitial}`, { playerId: r.playerId });
    notify();
  }
  function rejectSipRequest(reqId) {
    const r = state.sipRequests.find((x) => x.id === reqId);
    if (!r || r.status !== 'pending') return;
    r.status = 'rejected';
    r.resolvedAt = state.nowVirtual;
    // Refund the round quota
    state.sipsThisRound[r.playerId] = Math.max(0, (state.sipsThisRound[r.playerId] || 0) - r.amount);
    const p = state.players.find((p) => p.id === r.playerId);
    if (p) pushToastTo(p.id, { icon: '✗', text: 'Sip request rejected — slow down 😉' });
    log('sips_rejected', `Russell declined ${r.amount} sips for ${p?.firstName} ${p?.lastInitial}`, { playerId: r.playerId });
    notify();
  }

  // ── Transfers ────────────────────────────────────────────
  function transferDrinks({ fromId, toId, amount }) {
    if (amount <= 0) return { error: 'Amount must be positive' };
    const from = state.players.find((p) => p.id === fromId);
    const to = state.players.find((p) => p.id === toId);
    if (!from || !to) return { error: 'Player missing' };
    if (from.balance < amount) return { error: 'Not enough sips' };
    from.balance -= amount;
    // Recipient does NOT gain currency — they get a drinking obligation
    log('transfer', `${from.firstName} ${from.lastInitial} sent ${amount} sip${amount===1?'':'s'} to ${to.firstName} ${to.lastInitial} — drink up!`,
        { fromId, toId, amount });
    pushToastTo(toId, { icon: '🍺', text: `${from.firstName} says drink ${amount} sip${amount===1?'':'s'}!` });
    pushToastTo(fromId, { icon: '✓', text: `Sent ${amount} to ${to.firstName}` });
    notify();
    return { ok: true };
  }

  // ── Bets (propositions) ──────────────────────────────────
  function createBet({ createdBy, proposition }) {
    const player = state.players.find((p) => p.id === createdBy);
    if (!player) return { error: 'No player' };
    if (player.balance < 3) return { error: 'Need 3 sips to create a bet' };
    player.balance -= 3;
    const bet = {
      id: nextId('b'),
      createdBy, proposition,
      status: 'pending_approval',
      _vtime_created: state.nowVirtual,
      _vtime_expires: state.nowVirtual + 3600,
      totalFor: 0, totalAgainst: 0,
      wagers: [],
    };
    state.bets.unshift(bet);
    log('bet_created', `${player.firstName} ${player.lastInitial} proposed: "${proposition}"`, { betId: bet.id });
    pushToastTo(createdBy, { icon: '⏳', text: 'Bet sent for Russell to approve' });
    notify();
    return { ok: true, bet };
  }
  function approveBet(betId) {
    const b = state.bets.find((x) => x.id === betId);
    if (!b) return;
    b.status = 'open';
    b._vtime_approved = state.nowVirtual;
    log('bet_approved', `Bet approved: "${b.proposition}"`, { betId });
    pushToastTo(b.createdBy, { icon: '✓', text: 'Your bet is live!' });
    notify();
  }
  function rejectBet(betId) {
    const b = state.bets.find((x) => x.id === betId);
    if (!b) return;
    b.status = 'rejected';
    const p = state.players.find((p) => p.id === b.createdBy);
    if (p) p.balance += 3;
    log('bet_rejected', `Bet rejected: "${b.proposition}"`, { betId });
    pushToastTo(b.createdBy, { icon: '✗', text: 'Bet rejected — 3 sips refunded' });
    notify();
  }
  function placeWager({ betId, playerId, side, amount }) {
    const bet = state.bets.find((b) => b.id === betId);
    const player = state.players.find((p) => p.id === playerId);
    if (!bet || !player) return { error: 'Missing' };
    if (bet.status !== 'open') return { error: 'Bet not open' };
    if (amount < 1) return { error: 'Min 1 sip' };
    if (player.balance < amount) return { error: 'Not enough sips' };
    player.balance -= amount;
    bet.wagers.push({ id: nextId('w'), playerId, side, amount });
    if (side === 'for') bet.totalFor += amount;
    else bet.totalAgainst += amount;
    log('wager_placed', `${player.firstName} ${player.lastInitial} put ${amount} sip${amount===1?'':'s'} ${side.toUpperCase()} "${bet.proposition}"`, { betId, side, amount });
    notify();
    return { ok: true };
  }
  function resolveBet({ betId, outcome }) {
    const bet = state.bets.find((b) => b.id === betId);
    if (!bet) return;
    bet.status = outcome === 'for' ? 'resolved_won' : 'resolved_lost';
    bet._vtime_resolved = state.nowVirtual;
    const winningPool = outcome === 'for' ? bet.totalFor : bet.totalAgainst;
    const totalPot = bet.totalFor + bet.totalAgainst;
    for (const w of bet.wagers) {
      if (w.side !== outcome) { w.payout = 0; continue; }
      // Parimutuel share, rounded up — with a universal 1.5× floor so
      // even betting on a sure thing always pays back at least 1.5× rounded up.
      let payout = Math.ceil((w.amount / Math.max(winningPool, 1)) * totalPot);
      payout = Math.max(payout, Math.ceil(w.amount * 1.5));
      w.payout = payout;
      const player = state.players.find((p) => p.id === w.playerId);
      if (player) {
        player.balance += payout;
        pushToastTo(player.id, { icon: '🥂', text: `Won ${payout} sips on "${bet.proposition.slice(0,32)}…"` });
      }
    }
    log('bet_resolved', `"${bet.proposition}" → ${outcome === 'for' ? 'YES' : 'NO'} won`, { betId, outcome });
    notify();
  }

  // ── Roulette (group spin model) ──────────────────────────
  function timeToSpin() {
    if (!state.rouletteOpen || state.rouletteResult || state.rouletteSpinning) return 0;
    return Math.max(0, state.rouletteBetsCloseAt - state.nowVirtual);
  }
  function placeRouletteBet({ playerId, sliceId, amount }) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return { error: 'No player' };
    if (!state.rouletteOpen || state.rouletteSpinning || state.rouletteResult) return { error: 'Betting closed' };
    if (amount < 1) return { error: 'Min 1 sip' };
    if (player.balance < amount) return { error: 'Not enough sips' };
    const slice = state.rouletteSlices.find((s) => s.id === sliceId);
    if (!slice) return { error: 'No such slice' };
    if (slice.type === 'penalty') return { error: "That's a house slice — can't be bet on" };
    player.balance -= amount;
    state.rouletteBets.push({ id: nextId('rb'), playerId, sliceId, amount });
    log('roulette_bet', `${player.firstName} ${player.lastInitial} bet ${amount} sip${amount===1?'':'s'} on ${slice.label}`, { playerId });
    notify();
    return { ok: true };
  }

  function executeRouletteSpin() {
    state.rouletteSpinning = true;
    // Pick weighted slice
    const totalWeight = state.rouletteSlices.reduce((a, b) => a + b.weight, 0);
    let roll = Math.random() * totalWeight;
    let pickedIdx = 0;
    for (let i = 0; i < state.rouletteSlices.length; i++) {
      roll -= state.rouletteSlices[i].weight;
      if (roll <= 0) { pickedIdx = i; break; }
    }
    const slice = state.rouletteSlices[pickedIdx];

    // The visual spin takes ~5.6 seconds; we let it animate then commit payouts.
    // Save the chosen slice so the UI can compute its rotation target.
    const result = {
      sliceIdx: pickedIdx,
      slice,
      winners: [],
      losers: [],
      totalPot: state.rouletteBets.reduce((a, b) => a + b.amount, 0),
      finalized: false,
    };

    if (slice.type === 'dice') {
      // Single shared dice roll for everyone who bet on Dice
      result.dieValue = 1 + Math.floor(Math.random() * 6);
    } else if (slice.type === 'mini-game') {
      // Pick a random mini-game; everyone who bet plays the same one,
      // each independently. Results recorded as players finish.
      const games = ['numberGuess', 'coinFlip', 'higherLower', 'shotRoulette', 'dareOrDrink'];
      result.miniGame = games[Math.floor(Math.random() * games.length)];
      result.miniGameResults = {};   // playerId → { won, payout, betAmount }
      result.pendingPlayers = state.rouletteBets
        .filter((b) => b.sliceId === slice.id)
        .map((b) => b.playerId);
    }

    state.rouletteResult = result;
    notify();
  }

  // Multipliers for each mini-game (also exposed to the UI for previews).
  const MINI_GAME_PAYOUTS = {
    numberGuess: 10,
    coinFlip: 2,
    higherLower: 2,
    shotRoulette: 2,
    dareOrDrink: 5,
  };

  function finalizeRouletteSpin() {
    if (!state.rouletteResult || state.rouletteResult.finalized) return;
    const r = state.rouletteResult;
    const { slice } = r;
    const winners = [];
    const losers = [];

    for (const b of state.rouletteBets) {
      const p = state.players.find((pp) => pp.id === b.playerId);
      if (!p) continue;

      if (b.sliceId === slice.id) {
        // Winning slice — payout depends on type
        if (slice.type === 'multiplier') {
          const payout = Math.ceil(b.amount * slice.multiplier);
          p.balance += payout;
          winners.push({ playerId: b.playerId, amount: b.amount, payout });
          if (payout > b.amount) {
            pushToastTo(b.playerId, { icon: '🥂', text: `${slice.label}! +${payout} sips` });
          } else if (payout === 0) {
            pushToastTo(b.playerId, { icon: '💀', text: `${slice.label} — ${b.amount} sips gone` });
          } else {
            pushToastTo(b.playerId, { icon: '◐', text: `${slice.label} — got ${payout} back` });
          }
        } else if (slice.type === 'dice') {
          const payout = b.amount * r.dieValue;
          p.balance += payout;
          winners.push({ playerId: b.playerId, amount: b.amount, payout });
          pushToastTo(b.playerId, { icon: '🎲', text: `Dice rolled a ${r.dieValue} — +${payout} sips` });
        }
        // mini-game type: defer payout until each player plays
        // penalty type: no bets here (validated at bet time)
      } else {
        losers.push({ playerId: b.playerId, amount: b.amount });
        pushToastTo(b.playerId, { icon: '☠', text: `Wheel landed on ${slice.label} — lost ${b.amount}` });
      }
    }

    // House penalty: when Skulls (or any 'penalty' slice) lands, every
    // Skulls = drinking punishment, no balance change
    if (slice.type === 'penalty') {
      const amt = slice.penaltyAmount || 2;
      for (const p of state.players) {
        pushToastTo(p.id, { icon: '☠', text: `${slice.label}! Drink ${amt} sip${amt === 1 ? '' : 's'} from the house!` });
      }
      log('roulette_penalty',
        `${slice.label}! Everyone drinks ${amt} sip${amt === 1 ? '' : 's'} — punishment from the house!`);
    }

    r.winners = winners;
    r.losers = losers;

    if (slice.type === 'mini-game') {
      // Hold the result open while players resolve their mini-games.
      state.rouletteSpinning = false;
      log('roulette_result',
        `Round ${state.currentRound}: wheel landed on ${slice.label} — ${r.pendingPlayers.length} player${r.pendingPlayers.length === 1 ? '' : 's'} playing`);
      // Auto-resolve any bot players (not currently on a phone) after a short delay.
      setTimeout(() => {
        const pending = (state.rouletteResult?.pendingPlayers || []).slice();
        for (const playerId of pending) {
          if (!state.livePlayerIds.has(playerId)) {
            const won = Math.random() < 0.4;
            resolvePlayerMiniGame(playerId, won);
          }
        }
      }, 4500);
    } else {
      r.finalized = true;
      state.rouletteOpen = false;
      state.rouletteSpinning = false;
      state.rouletteHistory.unshift({
        roundId: state.rouletteRoundId,
        sliceId: slice.id,
        label: slice.label,
        multiplier: slice.type === 'dice' ? `×${r.dieValue}` : slice.multiplier,
        dieValue: r.dieValue,
      });
      log('roulette_result',
        slice.type === 'dice'
          ? `Round ${state.currentRound}: Dice rolled a ${r.dieValue} — ${winners.length} winner${winners.length === 1 ? '' : 's'}`
          : `Round ${state.currentRound}: wheel landed on ${slice.label} (×${slice.multiplier}) — ${winners.length} winner${winners.length === 1 ? '' : 's'}, ${losers.length} loser${losers.length === 1 ? '' : 's'}`);
    }
    notify();
  }

  function resolvePlayerMiniGame(playerId, won) {
    const r = state.rouletteResult;
    if (!r || r.slice.type !== 'mini-game') return;
    if (r.miniGameResults && r.miniGameResults[playerId]) return; // already resolved

    const playerBets = state.rouletteBets.filter((b) =>
      b.playerId === playerId && b.sliceId === r.slice.id);
    const totalBet = playerBets.reduce((a, b) => a + b.amount, 0);

    const payoutMult = MINI_GAME_PAYOUTS[r.miniGame] || 2;
    const payout = won ? Math.ceil(totalBet * payoutMult) : 0;

    const p = state.players.find((pp) => pp.id === playerId);
    if (p) p.balance += payout;

    r.miniGameResults = r.miniGameResults || {};
    r.miniGameResults[playerId] = { won, payout, betAmount: totalBet };
    if (won) {
      r.winners.push({ playerId, amount: totalBet, payout });
      pushToastTo(playerId, { icon: '🥂', text: `Won the mini-game! +${payout} sips` });
    } else {
      r.losers.push({ playerId, amount: totalBet });
      pushToastTo(playerId, { icon: '💀', text: `Lost the mini-game — ${totalBet} sips gone` });
    }

    r.pendingPlayers = (r.pendingPlayers || []).filter((id) => id !== playerId);

    if (r.pendingPlayers.length === 0) {
      r.finalized = true;
      state.rouletteOpen = false;
      state.rouletteSpinning = false;
      state.rouletteHistory.unshift({
        roundId: state.rouletteRoundId,
        sliceId: r.slice.id,
        label: `${r.slice.label} (${r.miniGame})`,
        multiplier: 'mini',
      });
      log('roulette_result',
        `Round ${state.currentRound}: ${r.slice.label} (${r.miniGame}) complete`);
    }
    notify();
  }

  function registerLivePlayer(playerId) {
    state.livePlayerIds.add(playerId);
  }
  function unregisterLivePlayer(playerId) {
    state.livePlayerIds.delete(playerId);
  }

  // ── Admin: slices / game control ─────────────────────────
  function updateSlice(id, patch) {
    const s = state.rouletteSlices.find((s) => s.id === id);
    if (s) Object.assign(s, patch);
    notify();
  }
  function addSlice() {
    state.rouletteSlices.push({
      id: nextId('s'), label: 'New Slice', type: 'multiplier', multiplier: 1, weight: 1, color: '#9DAE94',
    });
    notify();
  }
  function removeSlice(id) {
    state.rouletteSlices = state.rouletteSlices.filter((s) => s.id !== id);
    notify();
  }
  function setGameStatus(s) { state.gameStatus = s; notify(); }

  // Admin-controlled game start. Resets the round clock to "now",
  // grants the first auto credit drop, and opens the first wheel window.
  function startGame() {
    state.gameStatus = 'active';
    state.gameStartedAtVirtual = state.nowVirtual;
    state.currentRound = 1;
    state.sipsThisRound = {};
    state.rouletteBets = [];
    state.rouletteResult = null;
    state.rouletteSpinning = false;
    state.rouletteRoundId = nextId('rr');
    state.rouletteOpen = true;
    state.rouletteBetsCloseAt = state.nowVirtual + BET_WINDOW_LEN;
    // Auto credit drop
    for (const p of state.players) {
      p.balance += state.autoSipsPerRound;
      p.joinedRound = Math.min(p.joinedRound, 1);
      pushToastTo(p.id, { icon: '🥂', text: `Game started! +${state.autoSipsPerRound} sips` });
    }
    log('game_start', `Russell started the game — Round 1 begins, wheel betting open for 5 min`);
    log('credit_drop', `Round 1 — everyone got +${state.autoSipsPerRound} sips automatically`);
    notify();
  }

  // Put the game back in 'waiting' so you can test the lobby flow.
  function resetToWaiting() {
    state.gameStatus = 'waiting';
    state.currentRound = 0;
    state.rouletteOpen = false;
    state.rouletteResult = null;
    state.rouletteSpinning = false;
    state.rouletteBets = [];
    state.sipsThisRound = {};
    notify();
  }
  function restartGame() {
    state.gameStatus = 'waiting';
    state.currentRound = 0;
    state.rouletteOpen = false;
    state.rouletteResult = null;
    state.rouletteSpinning = false;
    state.rouletteBets = [];
    state.rouletteHistory = [];
    state.bets = [];
    state.activity = [];
    state.sipRequests = [];
    state.sipsThisRound = {};
    for (const p of state.players) p.balance = 0;
    log('game_start', 'Game has been reset by Russell. Waiting to start again.');
    notify();
  }
  function adjustBalance(playerId, delta) {
    const p = state.players.find((p) => p.id === playerId);
    if (p) p.balance = Math.max(0, p.balance + delta);
    notify();
  }
  function fastForwardToNextRound() {
    // bump round-start anchor back by enough to trigger the next-round flow
    const remaining = Math.max(0, (state.gameStartedAtVirtual + state.currentRound * ROUND_LEN) - state.nowVirtual);
    state.gameStartedAtVirtual -= remaining + 1;
    notify();
  }
  function spinWheelNow() {
    // Force the spin to happen immediately
    state.rouletteBetsCloseAt = state.nowVirtual;
    notify();
  }

  // ── Getters ──────────────────────────────────────────────
  function getPlayer(id) { return state.players.find((p) => p.id === id); }
  function timeToNextRound() {
    const next = (state.currentRound) * ROUND_LEN;
    const elapsed = state.nowVirtual - state.gameStartedAtVirtual;
    return Math.max(0, next - elapsed);
  }
  function getMyRouletteBets(playerId) {
    return state.rouletteBets.filter((b) => b.playerId === playerId);
  }
  function getRouletteBetsBySlice() {
    const map = {};
    for (const s of state.rouletteSlices) map[s.id] = { total: 0, count: 0, players: [] };
    for (const b of state.rouletteBets) {
      if (!map[b.sliceId]) continue;
      map[b.sliceId].total += b.amount;
      map[b.sliceId].count += 1;
      map[b.sliceId].players.push(b.playerId);
    }
    return map;
  }

  return {
    get state() { return state; },
    subscribe, setState, setSpeed,
    addPlayer, tryLogin,
    registerLivePlayer, unregisterLivePlayer,
    transferDrinks,
    createBet, approveBet, rejectBet, placeWager, resolveBet,
    placeRouletteBet, executeRouletteSpin, finalizeRouletteSpin,
    resolvePlayerMiniGame, MINI_GAME_PAYOUTS,
    requestSips, approveSipRequest, rejectSipRequest,
    sipsRemainingThisRound, sipsRequestedThisRound,
    updateSlice, addSlice, removeSlice,
    requestRegistration, approveRegistration, rejectRegistration, findPlayerByName,
    broadcastMessage: (msg) => { log('admin_broadcast', msg); notify(); },
    setRouletteDisabled: (d) => { state.rouletteDisabled = d; if (d) { state.rouletteOpen = false; } notify(); },
    setGameStatus, startGame, resetToWaiting, restartGame, adjustBalance,
    fastForwardToNextRound, spinWheelNow,
    drainToasts, getPlayer,
    timeToNextRound, timeToSpin,
    getMyRouletteBets, getRouletteBetsBySlice,
  };
}

const BroStore = makeStore();

function useStore() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => BroStore.subscribe(force), []);
  return BroStore;
}

function fmtMSS(secs) {
  secs = Math.max(0, Math.floor(secs));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtAgo(_vtime) {
  const diff = Math.max(0, BroStore.state.nowVirtual - _vtime);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
function fmtActivityAge(entry) {
  if (entry._vtime != null) return fmtAgo(entry._vtime);
  return '';
}

Object.assign(window, { BroStore, useStore, fmtMSS, fmtAgo, fmtActivityAge });
