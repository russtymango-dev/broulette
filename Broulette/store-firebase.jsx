// store-firebase.jsx — Broulette Firestore-backed game state
//
// Drop-in replacement for store.jsx. Same API surface, same window globals.
// All state is synced from Firestore via onSnapshot listeners.
// Mutations are Firestore writes (transactions where balance changes are involved).
// The admin's client runs the game loop (credit drops, roulette spins, bot resolution).
//
// Sips economy:
//   - Currency is SIPS. 10 sips = 1 IRL drink.
//   - AUTO: +5 sips every 30 min to everyone.
//   - BUY MORE: up to 5 extra per round, admin approves.

const ROUND_LEN = 30 * 60;       // 30 min in seconds
const BET_WINDOW_LEN = 5 * 60;   // 5 min betting window

const MINI_GAME_PAYOUTS = {
  numberGuess: 10,
  coinFlip: 2,
  higherLower: 2,
  shotRoulette: 2,
  dareOrDrink: 5,
};

const DEFAULT_SLICES = [
  { id: 's1', label: 'Cheers',    type: 'multiplier', multiplier: 2,    weight: 5, color: '#C9A961' },
  { id: 's2', label: 'Skulls',    type: 'penalty',    penaltyAmount: 2, weight: 5, color: '#7A2E3A' },
  { id: 's3', label: 'Sip Back',  type: 'multiplier', multiplier: 1.5,  weight: 3, color: '#9DAE94' },
  { id: 's4', label: 'Triple',    type: 'multiplier', multiplier: 3,    weight: 2, color: '#C97D85' },
  { id: 's5', label: 'JACKPOT',   type: 'multiplier', multiplier: 5,    weight: 1, color: '#9C7E3D' },
  { id: 's6', label: 'Dice',      type: 'dice',                         weight: 2, color: '#5E4A3E' },
  { id: 's7', label: 'Mini-Game', type: 'mini-game',                    weight: 2, color: '#B4626B' },
];

function makeStore() {
  let listeners = new Set();
  let _id = Date.now();
  const nextId = (p) => `${p}_${++_id}`;

  const playerToasts = {};
  let _myId = null;        // current logged-in player's Firebase UID
  let _myPlayerId = null;  // player doc ID
  let _isAdmin = false;
  let _isServer = false;   // only the "server" account runs the game loop
  let _listenersInitialized = false;
  let _unsubscribers = [];
  let _authReady = false;  // true once anonymous auth is done
  let _authReadyPromise = null; // resolves when auth is ready

  // Local state cache — same shape as in-memory store so UI code doesn't change
  const state = {
    gameStartedAtVirtual: 0,
    roundLen: ROUND_LEN,
    autoSipsPerRound: 5,
    extraSipsMax: 5,
    currentRound: 0,
    nowVirtual: Date.now() / 1000,
    gameStatus: 'waiting',
    speed: 1,

    registrationRequests: [],
    livePlayerIds: new Set(),
    players: [],
    bets: [],
    activity: [],
    sipRequests: [],
    sipsThisRound: {},

    rouletteSlices: [...DEFAULT_SLICES],
    rouletteDisabled: false,
    rouletteOpen: false,
    rouletteRoundId: null,
    rouletteBetsCloseAt: 0,
    rouletteSpinning: false,
    rouletteResult: null,
    rouletteBets: [],
    rouletteHistory: [],
  };

  // ── Subscriptions ────────────────────────────────────────
  const notify = () => { for (const fn of listeners) fn(); };
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const setState = (patch) => {
    Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
    notify();
  };

  // ── Real clock (no virtual clock in production) ──────────
  const setSpeed = () => {}; // no-op in production

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

  // ── Activity log helper (writes to Firestore) ───────────
  async function log(type, message, data = {}) {
    try {
      await activityRef.add({
        type, message,
        playerId: data.playerId || null,
        data,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        _vtime: Date.now() / 1000,
      });
    } catch (e) {
      console.warn('[Broulette] Failed to write activity log:', e);
    }
  }

  // ══════════════════════════════════════════════════════════
  // Firestore listeners — populate local state cache
  // ══════════════════════════════════════════════════════════

  function initListeners() {
    if (_listenersInitialized) return;
    _listenersInitialized = true;

    // Game document
    _unsubscribers.push(gameRef.onSnapshot((snap) => {
      if (!snap.exists) return;
      const d = snap.data();
      state.gameStatus = d.status || 'waiting';
      state.gameStartedAtVirtual = d.startedAt ? d.startedAt.toMillis() / 1000 : 0;
      state.roundLen = d.roundLen || ROUND_LEN;
      state.autoSipsPerRound = d.autoSipsPerRound ?? 5;
      state.extraSipsMax = d.extraSipsMax ?? 5;
      state.currentRound = d.currentRound || 0;
      state.rouletteDisabled = d.rouletteDisabled || false;
      state.rouletteOpen = d.rouletteOpen || false;
      state.rouletteRoundId = d.rouletteRoundId || null;
      state.rouletteBetsCloseAt = d.rouletteBetsCloseAt ? d.rouletteBetsCloseAt.toMillis() / 1000 : 0;
      state.rouletteSpinning = d.rouletteSpinning || false;
      state.rouletteResult = d.rouletteResult || null;
      state.rouletteSlices = d.rouletteSlices || [...DEFAULT_SLICES];
      state.sipsThisRound = d.sipsThisRound || {};

      // Cross-client toasts are handled by the activity log listener below.
      // The game doc listener only syncs state.

      notify();
    }));

    // Players
    _unsubscribers.push(playersRef.onSnapshot((snap) => {
      state.players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Update admin/server flags for current user
      if (_myPlayerId) {
        const me = state.players.find(p => p.id === _myPlayerId);
        if (me) {
          _isAdmin = me.isAdmin === true;
          _isServer = me.isServer === true;
        }
      }
      notify();
    }));

    // Bets (with wagers as subcollection — we'll flatten them)
    _unsubscribers.push(betsRef.orderBy('createdAt', 'desc').onSnapshot(async (snap) => {
      const betsData = [];
      for (const doc of snap.docs) {
        const bet = { id: doc.id, ...doc.data() };
        // Convert timestamps to _vtime for UI compatibility
        if (bet.createdAt) bet._vtime_created = bet.createdAt.toMillis() / 1000;
        if (bet.expiresAt) bet._vtime_expires = bet.expiresAt.toMillis() / 1000;
        if (bet.approvedAt) bet._vtime_approved = bet.approvedAt.toMillis() / 1000;
        if (bet.resolvedAt) bet._vtime_resolved = bet.resolvedAt.toMillis() / 1000;
        bet.wagers = bet.wagers || [];
        betsData.push(bet);
      }
      state.bets = betsData;
      notify();
    }));

    // Roulette bets (current round)
    _unsubscribers.push(rouletteBetsRef.onSnapshot((snap) => {
      state.rouletteBets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notify();
    }));

    // Roulette history
    _unsubscribers.push(rouletteHistoryRef.orderBy('roundNumber', 'desc').onSnapshot((snap) => {
      state.rouletteHistory = snap.docs.map(d => ({ roundId: d.id, ...d.data() }));
      notify();
    }));

    // Activity log (last 200) + cross-client toast notifications
    let _seenActivityIds = new Set();
    let _activityInitialized = false;
    _unsubscribers.push(activityRef.orderBy('_vtime', 'desc').limit(200).onSnapshot((snap) => {
      state.activity = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data };
      });

      // Push toasts for NEW activity entries involving the current player
      if (_activityInitialized && _myPlayerId) {
        for (const doc of snap.docChanges()) {
          if (doc.type !== 'added') continue;
          const a = doc.doc.data();
          const id = doc.doc.id;
          if (_seenActivityIds.has(id)) continue;

          // Transfer: notify recipient (they've been punished!)
          if (a.type === 'transfer' && a.data?.toId === _myPlayerId) {
            const fromName = state.players.find(p => p.id === a.data?.fromId);
            pushToastTo(_myPlayerId, { icon: '🍺', text: `${fromName?.firstName || 'Someone'} says drink ${a.data?.amount} sip${a.data?.amount === 1 ? '' : 's'}!` });
          }
          // Transfer: confirm to sender
          if (a.type === 'transfer' && a.data?.fromId === _myPlayerId) {
            const toName = state.players.find(p => p.id === a.data?.toId);
            pushToastTo(_myPlayerId, { icon: '✓', text: `Sent ${a.data?.amount} to ${toName?.firstName || 'someone'}` });
          }
          // Sip request approved
          if (a.type === 'sips_approved' && a.data?.playerId === _myPlayerId) {
            pushToastTo(_myPlayerId, { icon: '🥂', text: `Russell approved your sip request` });
          }
          // Sip request rejected
          if (a.type === 'sips_rejected' && a.data?.playerId === _myPlayerId) {
            pushToastTo(_myPlayerId, { icon: '✗', text: 'Sip request rejected' });
          }
          // Bet approved (notify creator)
          if (a.type === 'bet_approved' && a.data?.betId) {
            const bet = state.bets.find(b => b.id === a.data.betId);
            if (bet && bet.createdBy === _myPlayerId) {
              pushToastTo(_myPlayerId, { icon: '✓', text: 'Your bet is live!' });
            }
          }
          // Bet rejected (notify creator)
          if (a.type === 'bet_rejected' && a.data?.betId) {
            const bet = state.bets.find(b => b.id === a.data.betId);
            if (bet && bet.createdBy === _myPlayerId) {
              pushToastTo(_myPlayerId, { icon: '✗', text: 'Bet rejected — 3 sips refunded' });
            }
          }
          // Player joined (notify the new player)
          if (a.type === 'player_joined' && a.message?.includes(_myPlayerId)) {
            pushToastTo(_myPlayerId, { icon: '🥂', text: 'Welcome to Broulette!' });
          }
          // Credit drop
          if (a.type === 'credit_drop') {
            pushToastTo(_myPlayerId, { icon: '+', text: a.message });
          }
          // Roulette penalty (Skulls — everyone)
          if (a.type === 'roulette_penalty') {
            pushToastTo(_myPlayerId, { icon: '☠', text: a.message });
          }
          // Roulette result
          if (a.type === 'roulette_result' && a.message && !a.message.includes('spinning')) {
            pushToastTo(_myPlayerId, { icon: '🎰', text: a.message });
          }
          // Game start
          if (a.type === 'game_start') {
            pushToastTo(_myPlayerId, { icon: '🥂', text: a.message });
          }
          // Admin broadcast — always notify everyone
          if (a.type === 'admin_broadcast') {
            pushToastTo(_myPlayerId, { icon: '📢', text: a.message });
          }
        }
      }

      // Track seen IDs (first snapshot is the initial load — don't toast those)
      _seenActivityIds = new Set(snap.docs.map(d => d.id));
      _activityInitialized = true;
      notify();
    }));

    // Sip requests
    _unsubscribers.push(sipRequestsRef.orderBy('requestedAt', 'desc').onSnapshot((snap) => {
      state.sipRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notify();
    }));

    // Registration requests
    _unsubscribers.push(regRequestsRef.orderBy('requestedAt', 'desc').onSnapshot((snap) => {
      state.registrationRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notify();
    }));
  }

  // ══════════════════════════════════════════════════════════
  // Game loop — runs on admin's client only
  // ══════════════════════════════════════════════════════════

  let _gameLoopBusy = false; // prevent re-entrancy

  let _lastDebugLog = 0;
  setInterval(() => {
    const now = Date.now() / 1000;
    state.nowVirtual = now;

    // Debug logging every 10 seconds on admin/server tabs
    if ((_isServer || _isAdmin) && now - _lastDebugLog > 10) {
      _lastDebugLog = now;
      console.log('[GameLoop]', {
        isServer: _isServer,
        isAdmin: _isAdmin,
        playerId: _myPlayerId,
        status: state.gameStatus,
        started: state.gameStartedAtVirtual,
        busy: _gameLoopBusy,
        round: state.currentRound,
        rouletteOpen: state.rouletteOpen,
        spinning: state.rouletteSpinning,
        result: !!state.rouletteResult,
        betsCloseAt: state.rouletteBetsCloseAt,
        now: now,
        secsUntilSpin: Math.round(state.rouletteBetsCloseAt - now),
      });
    }

    if (!_isServer || state.gameStatus !== 'active' || !state.gameStartedAtVirtual || _gameLoopBusy) {
      notify();
      return;
    }

    const elapsed = now - state.gameStartedAtVirtual;
    const expectedRound = Math.floor(elapsed / ROUND_LEN) + 1;

    // Round transition (credit drops + open new betting window)
    if (expectedRound > state.currentRound) {
      _gameLoopBusy = true;
      console.log('[GameLoop] Starting round', expectedRound);
      adminStartNewRound(expectedRound)
        .then(() => console.log('[GameLoop] Round', expectedRound, 'started'))
        .catch(e => console.error('[GameLoop] Round start failed:', e))
        .finally(() => { _gameLoopBusy = false; });
    }
    // Auto-close betting window when time expires (but DON'T auto-spin — admin does that manually)
    else if (state.rouletteOpen && !state.rouletteSpinning && !state.rouletteResult
        && now >= state.rouletteBetsCloseAt) {
      _gameLoopBusy = true;
      console.log('[GameLoop] Closing betting window — waiting for admin to spin');
      gameRef.update({ rouletteOpen: false })
        .catch(e => console.error('[GameLoop] Failed to close betting:', e))
        .finally(() => { _gameLoopBusy = false; });
    }

    notify();
  }, 1000);

  // Also tick for non-admin clients to update nowVirtual for countdown displays
  setInterval(() => {
    if (_isAdmin) return;
    state.nowVirtual = Date.now() / 1000;
    notify();
  }, 1000);

  // ══════════════════════════════════════════════════════════
  // Anonymous auth — sign in immediately so Firestore reads work
  // ══════════════════════════════════════════════════════════

  _authReadyPromise = (async () => {
    try {
      let user = auth.currentUser;
      if (!user) {
        const cred = await auth.signInAnonymously();
        user = cred.user;
      }
      _myId = user.uid;
      _authReady = true;
      console.log('[Broulette] Authenticated anonymously:', user.uid);
      initListeners();
    } catch (e) {
      console.error('[Broulette] Anonymous auth failed:', e);
    }
  })();

  // ══════════════════════════════════════════════════════════
  // Auth — login & registration
  // ══════════════════════════════════════════════════════════

  async function requestRegistration({ firstName, lastInitial, pin }) {
    await _authReadyPromise; // ensure we're authed before reading

    // Check against local state (populated by listeners)
    const dup = state.players.find(p =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase()
    );
    if (dup) return { error: 'That name is taken — try a different last initial.' };

    // Check for existing pending request in local state
    const existingReq = state.registrationRequests.find(r =>
      r.status === 'pending' &&
      r.firstName.toLowerCase() === firstName.toLowerCase() &&
      r.lastInitial.toLowerCase() === lastInitial.toLowerCase()
    );
    if (existingReq) return { ok: true, request: existingReq, duplicate: true };

    const hashedPin = await hashPin(pin);
    const reqRef = await regRequestsRef.add({
      firstName, lastInitial,
      pin: hashedPin,
      plainPin: pin,  // Russell needs to see PINs for recovery
      status: 'pending',
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const req = { id: reqRef.id, firstName, lastInitial, pin: hashedPin, plainPin: pin, status: 'pending' };
    await log('signup_requested', `${firstName} ${lastInitial} wants to join the game`);
    return { ok: true, request: req };
  }

  function addPlayer(args) { return requestRegistration(args); }

  async function approveRegistration(reqId) {
    const reqDoc = await regRequestsRef.doc(reqId).get();
    if (!reqDoc.exists) return;
    const r = reqDoc.data();
    if (r.status !== 'pending') return;

    const playerId = nextId('p');

    const avatars = ['blush', 'gold', 'sage', 'burg'];
    const playerData = {
      firstName: r.firstName,
      lastInitial: r.lastInitial,
      displayName: `${r.firstName} ${r.lastInitial}`,
      pin: r.pin,
      plainPin: r.plainPin || '',
      balance: state.gameStatus === 'active' ? state.autoSipsPerRound : 0,
      isAdmin: false,
      avatar: avatars[state.players.length % 4],
      joinedRound: state.currentRound || 0,
    };

    await playersRef.doc(playerId).set(playerData);
    await regRequestsRef.doc(reqId).update({
      status: 'approved',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      playerId,
    });
    await log('player_joined', `${r.firstName} ${r.lastInitial} joined (approved by Russell)`);
  }

  async function rejectRegistration(reqId) {
    const reqDoc = await regRequestsRef.doc(reqId).get();
    if (!reqDoc.exists) return;
    const r = reqDoc.data();
    if (r.status !== 'pending') return;

    await regRequestsRef.doc(reqId).update({
      status: 'rejected',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await log('signup_rejected', `Russell declined a sign-up from ${r.firstName} ${r.lastInitial}`);
  }

  function findPlayerByName(firstName, lastInitial) {
    return state.players.find(p =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase()
    ) || null;
  }

  async function tryLogin({ firstName, lastInitial, pin }) {
    await _authReadyPromise; // ensure auth + listeners are ready

    // Wait briefly for listeners to populate state if they haven't yet
    if (state.players.length === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const hashedPin = await hashPin(pin);
    const player = state.players.find(p =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase() &&
      p.pin === hashedPin
    );
    if (!player) return null;

    _myPlayerId = player.id;
    _isAdmin = player.isAdmin === true;
    _isServer = player.isServer === true;

    // If admin or server, register our auth UID on the game doc for security rules
    if ((_isAdmin || _isServer) && _myId) {
      try {
        await gameRef.update({
          adminUids: firebase.firestore.FieldValue.arrayUnion(_myId),
        });
      } catch (e) {
        console.warn('[Broulette] Could not register admin UID (may need to seed adminUids first):', e);
      }
    }

    return player;
  }

  // ══════════════════════════════════════════════════════════
  // Sip requests (buy more sips)
  // ══════════════════════════════════════════════════════════

  function sipsRequestedThisRound(playerId) {
    // Compute from sipRequests in the current round (pending + approved)
    return state.sipRequests
      .filter(r => r.playerId === playerId && r.round === state.currentRound &&
        (r.status === 'pending' || r.status === 'approved'))
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }
  function sipsRemainingThisRound(playerId) {
    return Math.max(0, (state.extraSipsMax || 5) - sipsRequestedThisRound(playerId));
  }

  async function requestSips({ playerId, amount }) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return { error: 'No player' };
    const remaining = sipsRemainingThisRound(playerId);
    if (amount > remaining) return { error: `Only ${remaining} extra sip${remaining === 1 ? '' : 's'} left this round` };
    if (amount < 1) return { error: 'Must request at least 1 sip' };

    await sipRequestsRef.add({
      playerId, amount,
      round: state.currentRound,
      status: 'pending',
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await log('sips_requested',
      `${p.firstName} ${p.lastInitial} asked Russell for ${amount} extra sip${amount === 1 ? '' : 's'}`,
      { playerId });
    pushToastTo(playerId, { icon: '⏳', text: 'Sent to Russell for approval' });
    return { ok: true };
  }

  async function approveSipRequest(reqId) {
    const reqDoc = await sipRequestsRef.doc(reqId).get();
    if (!reqDoc.exists) return;
    const r = reqDoc.data();
    if (r.status !== 'pending') return;

    await sipRequestsRef.doc(reqId).update({
      status: 'approved',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const p = state.players.find(x => x.id === r.playerId);
    if (p) {
      await playersRef.doc(r.playerId).update({
        balance: firebase.firestore.FieldValue.increment(r.amount),
      });
      pushToastTo(r.playerId, { icon: '🥂', text: `Russell approved +${r.amount} sip${r.amount === 1 ? '' : 's'}` });
    }
    await log('sips_approved',
      `Russell approved +${r.amount} sip${r.amount === 1 ? '' : 's'} for ${p?.firstName} ${p?.lastInitial}`,
      { playerId: r.playerId });
  }

  async function rejectSipRequest(reqId) {
    const reqDoc = await sipRequestsRef.doc(reqId).get();
    if (!reqDoc.exists) return;
    const r = reqDoc.data();
    if (r.status !== 'pending') return;

    await sipRequestsRef.doc(reqId).update({
      status: 'rejected',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Quota auto-adjusts because sipsRequestedThisRound now filters out rejected requests

    const p = state.players.find(x => x.id === r.playerId);
    if (p) pushToastTo(r.playerId, { icon: '✗', text: 'Sip request rejected — slow down 😉' });
    await log('sips_rejected',
      `Russell declined ${r.amount} sips for ${p?.firstName} ${p?.lastInitial}`,
      { playerId: r.playerId });
  }

  // ══════════════════════════════════════════════════════════
  // Transfers
  // ══════════════════════════════════════════════════════════

  async function transferDrinks({ fromId, toId, amount }) {
    if (amount <= 0) return { error: 'Amount must be positive' };
    const from = state.players.find(p => p.id === fromId);
    const to = state.players.find(p => p.id === toId);
    if (!from || !to) return { error: 'Player missing' };
    if (from.balance < amount) return { error: 'Not enough sips' };

    // Sender spends currency, recipient gets a DRINKING OBLIGATION (not currency).
    // Recipient's balance does NOT change — they just have to drink IRL.
    const batch = db.batch();
    batch.update(playersRef.doc(fromId), {
      balance: firebase.firestore.FieldValue.increment(-amount),
    });
    const transferDoc = transfersRef.doc();
    batch.set(transferDoc, {
      fromPlayerId: fromId, toPlayerId: toId, amount,
      round: state.currentRound,
      _vtime: Date.now() / 1000,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    await log('transfer',
      `${from.firstName} ${from.lastInitial} sent ${amount} sip${amount === 1 ? '' : 's'} to ${to.firstName} ${to.lastInitial} — drink up!`,
      { fromId, toId, amount });
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════
  // Bets (propositions)
  // ══════════════════════════════════════════════════════════

  async function createBet({ createdBy, proposition }) {
    const player = state.players.find(p => p.id === createdBy);
    if (!player) return { error: 'No player' };
    if (player.balance < 3) return { error: 'Need 3 sips to create a bet' };

    await playersRef.doc(createdBy).update({
      balance: firebase.firestore.FieldValue.increment(-3),
    });

    const now = Date.now() / 1000;
    const betData = {
      createdBy, proposition,
      status: 'pending_approval',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: firebase.firestore.Timestamp.fromMillis((now + 3600) * 1000),
      totalFor: 0, totalAgainst: 0,
      creationCost: 3,
      wagers: [],
      _vtime_created: now,
      _vtime_expires: now + 3600,
    };
    const betRef = await betsRef.add(betData);

    await log('bet_created',
      `${player.firstName} ${player.lastInitial} proposed: "${proposition}"`,
      { betId: betRef.id });
    pushToastTo(createdBy, { icon: '⏳', text: 'Bet sent for Russell to approve' });
    return { ok: true, bet: { id: betRef.id, ...betData } };
  }

  async function approveBet(betId) {
    await betsRef.doc(betId).update({
      status: 'open',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _vtime_approved: Date.now() / 1000,
    });
    const b = state.bets.find(x => x.id === betId);
    await log('bet_approved', `Bet approved: "${b?.proposition}"`, { betId });
    if (b) pushToastTo(b.createdBy, { icon: '✓', text: 'Your bet is live!' });
  }

  async function rejectBet(betId) {
    const b = state.bets.find(x => x.id === betId);
    await betsRef.doc(betId).update({ status: 'rejected' });
    if (b) {
      await playersRef.doc(b.createdBy).update({
        balance: firebase.firestore.FieldValue.increment(3),
      });
      pushToastTo(b.createdBy, { icon: '✗', text: 'Bet rejected — 3 sips refunded' });
    }
    await log('bet_rejected', `Bet rejected: "${b?.proposition}"`, { betId });
  }

  async function placeWager({ betId, playerId, side, amount }) {
    const bet = state.bets.find(b => b.id === betId);
    const player = state.players.find(p => p.id === playerId);
    if (!bet || !player) return { error: 'Missing' };
    if (bet.status !== 'open') return { error: 'Bet not open' };
    if (amount < 1) return { error: 'Min 1 sip' };
    if (player.balance < amount) return { error: 'Not enough sips' };

    // Deduct balance and add wager
    await playersRef.doc(playerId).update({
      balance: firebase.firestore.FieldValue.increment(-amount),
    });

    const wager = { id: nextId('w'), playerId, side, amount };
    const updateField = side === 'for' ? 'totalFor' : 'totalAgainst';
    await betsRef.doc(betId).update({
      wagers: firebase.firestore.FieldValue.arrayUnion(wager),
      [updateField]: firebase.firestore.FieldValue.increment(amount),
    });

    await log('wager_placed',
      `${player.firstName} ${player.lastInitial} put ${amount} sip${amount === 1 ? '' : 's'} ${side.toUpperCase()} "${bet.proposition}"`,
      { betId, side, amount });
    return { ok: true };
  }

  async function resolveBet({ betId, outcome }) {
    const bet = state.bets.find(b => b.id === betId);
    if (!bet) return;

    const newStatus = outcome === 'for' ? 'resolved_won' : 'resolved_lost';
    const winningPool = outcome === 'for' ? bet.totalFor : bet.totalAgainst;
    const totalPot = bet.totalFor + bet.totalAgainst;

    const batch = db.batch();
    const updatedWagers = [];

    for (const w of (bet.wagers || [])) {
      if (w.side !== outcome) {
        updatedWagers.push({ ...w, payout: 0 });
        continue;
      }
      let payout = Math.ceil((w.amount / Math.max(winningPool, 1)) * totalPot);
      payout = Math.max(payout, Math.ceil(w.amount * 1.5));
      updatedWagers.push({ ...w, payout });

      batch.update(playersRef.doc(w.playerId), {
        balance: firebase.firestore.FieldValue.increment(payout),
      });
      pushToastTo(w.playerId, { icon: '🥂', text: `Won ${payout} sips on "${bet.proposition.slice(0, 32)}…"` });
    }

    batch.update(betsRef.doc(betId), {
      status: newStatus,
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      _vtime_resolved: Date.now() / 1000,
      wagers: updatedWagers,
    });

    await batch.commit();
    await log('bet_resolved', `"${bet.proposition}" → ${outcome === 'for' ? 'YES' : 'NO'} won`, { betId, outcome });
  }

  // ══════════════════════════════════════════════════════════
  // Roulette (group spin)
  // ══════════════════════════════════════════════════════════

  function timeToSpin() {
    if (!state.rouletteOpen || state.rouletteResult || state.rouletteSpinning) return 0;
    return Math.max(0, state.rouletteBetsCloseAt - (Date.now() / 1000));
  }

  async function placeRouletteBet({ playerId, sliceId, amount }) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'No player' };
    if (!state.rouletteOpen || state.rouletteSpinning || state.rouletteResult) return { error: 'Betting closed' };
    if (amount < 1) return { error: 'Min 1 sip' };
    if (player.balance < amount) return { error: 'Not enough sips' };
    const slice = state.rouletteSlices.find(s => s.id === sliceId);
    if (!slice) return { error: 'No such slice' };
    if (slice.type === 'penalty') return { error: "That's a house slice — can't be bet on" };

    await playersRef.doc(playerId).update({
      balance: firebase.firestore.FieldValue.increment(-amount),
    });
    await rouletteBetsRef.add({ playerId, sliceId, amount });

    await log('roulette_bet',
      `${player.firstName} ${player.lastInitial} bet ${amount} sip${amount === 1 ? '' : 's'} on ${slice.label}`,
      { playerId });
    return { ok: true };
  }

  async function executeRouletteSpin() {
    console.log('[SPIN] executeRouletteSpin called', { isServer: _isServer, isAdmin: _isAdmin });
    if (!_isServer && !_isAdmin) { console.log('[SPIN] BLOCKED: not server or admin'); return; }

    const slices = state.rouletteSlices;
    const totalWeight = slices.reduce((a, b) => a + b.weight, 0);
    let roll = Math.random() * totalWeight;
    let pickedIdx = 0;
    for (let i = 0; i < slices.length; i++) {
      roll -= slices[i].weight;
      if (roll <= 0) { pickedIdx = i; break; }
    }
    const slice = slices[pickedIdx];

    console.log('[SPIN] Picked slice:', slice.label, '| Bets:', state.rouletteBets.length, '| TotalPot:', state.rouletteBets.reduce((a, b) => a + b.amount, 0));

    const result = {
      sliceIdx: pickedIdx,
      slice,
      winners: [],
      losers: [],
      totalPot: state.rouletteBets.reduce((a, b) => a + b.amount, 0),
      finalized: false,
    };

    if (slice.type === 'dice') {
      result.dieValue = 1 + Math.floor(Math.random() * 6);
    } else if (slice.type === 'mini-game') {
      const games = ['numberGuess', 'coinFlip', 'higherLower', 'shotRoulette', 'dareOrDrink'];
      result.miniGame = games[Math.floor(Math.random() * games.length)];
      result.miniGameResults = {};
      result.pendingPlayers = state.rouletteBets
        .filter(b => b.sliceId === slice.id)
        .map(b => b.playerId);
    }

    await gameRef.update({
      rouletteSpinning: true,
      rouletteResult: result,
    });
    console.log('[SPIN] Result written to Firestore — waiting for UI animation');

    await log('roulette_result', `Round ${state.currentRound}: the wheel is spinning...`);
  }

  let _finalizingInProgress = false;
  async function finalizeRouletteSpin() {
    console.log('[FINALIZE] finalizeRouletteSpin called', {
      isServer: _isServer, isAdmin: _isAdmin,
      hasResult: !!state.rouletteResult,
      finalized: state.rouletteResult?.finalized,
      inProgress: _finalizingInProgress,
    });

    if (!_isServer && !_isAdmin) { console.log('[FINALIZE] BLOCKED: not server or admin'); return; }
    if (!state.rouletteResult || state.rouletteResult.finalized) { console.log('[FINALIZE] BLOCKED: no result or already finalized'); return; }
    if (_finalizingInProgress) { console.log('[FINALIZE] BLOCKED: already in progress'); return; }
    _finalizingInProgress = true;

    try {
    const freshGame = await gameRef.get();
    const freshResult = freshGame.data()?.rouletteResult;
    if (!freshResult || freshResult.finalized) {
      console.log('[FINALIZE] BLOCKED: Firestore shows already finalized');
      _finalizingInProgress = false; return;
    }

    const r = state.rouletteResult;
    console.log('[FINALIZE] Processing payouts for slice:', r.slice?.label, '| type:', r.slice?.type, '| bets:', state.rouletteBets.length);
    const { slice } = r;
    const winners = [];
    const losers = [];
    const batch = db.batch();

    console.log('[FINALIZE] Roulette bets to process:', state.rouletteBets.map(b => ({
      player: b.playerId, slice: b.sliceId, amount: b.amount
    })));
    console.log('[FINALIZE] Winning sliceId:', slice.id);

    for (const b of state.rouletteBets) {
      const p = state.players.find(pp => pp.id === b.playerId);
      if (!p) { console.log('[FINALIZE] Skipping bet — player not found:', b.playerId); continue; }

      if (b.sliceId === slice.id) {
        console.log('[FINALIZE] WINNER:', p.firstName, p.lastInitial, '| bet', b.amount, 'on', slice.label);
        if (slice.type === 'multiplier') {
          const payout = Math.ceil(b.amount * slice.multiplier);
          console.log('[FINALIZE] Payout:', payout, '(', b.amount, '×', slice.multiplier, ')');
          batch.update(playersRef.doc(b.playerId), {
            balance: firebase.firestore.FieldValue.increment(payout),
          });
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
          batch.update(playersRef.doc(b.playerId), {
            balance: firebase.firestore.FieldValue.increment(payout),
          });
          winners.push({ playerId: b.playerId, amount: b.amount, payout });
          pushToastTo(b.playerId, { icon: '🎲', text: `Dice rolled a ${r.dieValue} — +${payout} sips` });
        }
      } else {
        losers.push({ playerId: b.playerId, amount: b.amount });
        pushToastTo(b.playerId, { icon: '☠', text: `Wheel landed on ${slice.label} — lost ${b.amount}` });
      }
    }

    // Penalty (Skulls): everyone drinks and gets sips (skip hidden server)
    if (slice.type === 'penalty') {
      const amt = slice.penaltyAmount || 2;
      console.log('[FINALIZE] PENALTY SLICE — giving', amt, 'sips to all', state.players.filter(p => !p.hidden).length, 'players');
      for (const p of state.players) {
        if (p.hidden) continue;
        console.log('[FINALIZE] Skulls punishment for', p.firstName, p.lastInitial, '— drink', amt);
        // No balance change — Skulls is a drinking punishment, not currency
        // Create a transfer log from "The Wheel" so it shows in "Sips to drink" card
        await log('transfer',
          `The Wheel says ${p.firstName} ${p.lastInitial} must drink ${amt} sip${amt === 1 ? '' : 's'}!`,
          { fromId: 'p_wheel', toId: p.id, amount: amt });
        pushToastTo(p.id, { icon: '☠', text: `${slice.label}! Drink ${amt} sip${amt === 1 ? '' : 's'} from the house!` });
      }
      await log('roulette_penalty',
        `${slice.label}! Everyone drinks ${amt} sip${amt === 1 ? '' : 's'} — punishment from the house!`);
    }

    const updatedResult = { ...r, winners, losers };

    if (slice.type === 'mini-game') {
      updatedResult.finalized = false;
      batch.update(gameRef, {
        rouletteSpinning: false,
        rouletteResult: updatedResult,
      });
      await batch.commit();
      await log('roulette_result',
        `Round ${state.currentRound}: wheel landed on ${slice.label} — ${(r.pendingPlayers || []).length} player(s) playing`);

      // Auto-resolve unresolved players after delay.
      // Longer timeout (20s) to give real players on their phones time to
      // resolve first — avoids double-payout race condition.
      setTimeout(async () => {
        // Re-read the latest result from Firestore to avoid stale local state
        const freshGame = await gameRef.get();
        const freshResult = freshGame.data()?.rouletteResult;
        if (!freshResult || freshResult.finalized) return;
        const pending = (freshResult.pendingPlayers || []).slice();
        for (const playerId of pending) {
          const won = Math.random() < 0.4;
          await resolvePlayerMiniGame(playerId, won);
        }
      }, 20000);
    } else {
      updatedResult.finalized = true;
      batch.update(gameRef, {
        rouletteOpen: false,
        rouletteSpinning: false,
        rouletteResult: updatedResult,
      });

      // Write history
      const historyDoc = rouletteHistoryRef.doc(state.rouletteRoundId || nextId('rh'));
      const histMultiplier = slice.type === 'dice' ? `×${r.dieValue}`
        : slice.type === 'penalty' ? 'penalty'
        : (slice.multiplier || 0);
      batch.set(historyDoc, {
        roundNumber: state.currentRound,
        sliceId: slice.id,
        label: slice.label,
        multiplier: histMultiplier,
        dieValue: r.dieValue || null,
      });

      console.log('[FINALIZE] Committing batch —', winners.length, 'winners,', losers.length, 'losers, penalty:', slice.type === 'penalty');
      await batch.commit();
      console.log('[FINALIZE] Batch committed successfully!');

      // Build winner names for the feed
      const winnerNames = winners.map(w => {
        const p = state.players.find(pp => pp.id === w.playerId);
        return p ? `${p.firstName} ${p.lastInitial} (+${w.payout})` : '?';
      }).join(', ');

      await log('roulette_result',
        slice.type === 'dice'
          ? `Round ${state.currentRound}: Dice rolled ${r.dieValue}! ${winnerNames || 'No winners'}`
          : slice.type === 'penalty'
          ? `Round ${state.currentRound}: ${slice.label}! Everyone drinks ${slice.penaltyAmount || 2} sips from the house`
          : winners.length > 0
          ? `Round ${state.currentRound}: ${slice.label} (×${slice.multiplier})! ${winnerNames}`
          : `Round ${state.currentRound}: ${slice.label} (×${slice.multiplier}) — no winners`);
    }
    } finally {
      _finalizingInProgress = false;
    }
  }

  async function resolvePlayerMiniGame(playerId, won) {
    const r = state.rouletteResult;
    if (!r || r.slice.type !== 'mini-game') return;
    if (r.miniGameResults && r.miniGameResults[playerId]) return;

    // Double-check against Firestore to prevent double-payout race condition
    const freshGame = await gameRef.get();
    const freshResult = freshGame.data()?.rouletteResult;
    if (!freshResult || freshResult.finalized) return;
    if (freshResult.miniGameResults && freshResult.miniGameResults[playerId]) return;

    const playerBets = state.rouletteBets.filter(b =>
      b.playerId === playerId && b.sliceId === r.slice.id);
    const totalBet = playerBets.reduce((a, b) => a + b.amount, 0);

    const payoutMult = MINI_GAME_PAYOUTS[r.miniGame] || 2;
    const payout = won ? Math.ceil(totalBet * payoutMult) : 0;

    if (payout > 0) {
      await playersRef.doc(playerId).update({
        balance: firebase.firestore.FieldValue.increment(payout),
      });
    }

    const updatedResult = { ...r };
    updatedResult.miniGameResults = { ...(r.miniGameResults || {}), [playerId]: { won, payout, betAmount: totalBet } };
    if (won) {
      updatedResult.winners = [...(r.winners || []), { playerId, amount: totalBet, payout }];
      pushToastTo(playerId, { icon: '🥂', text: `Won the mini-game! +${payout} sips` });
    } else {
      updatedResult.losers = [...(r.losers || []), { playerId, amount: totalBet }];
      pushToastTo(playerId, { icon: '💀', text: `Lost the mini-game — ${totalBet} sips gone` });
    }
    updatedResult.pendingPlayers = (r.pendingPlayers || []).filter(id => id !== playerId);

    if (updatedResult.pendingPlayers.length === 0) {
      updatedResult.finalized = true;
      const historyDoc = rouletteHistoryRef.doc(state.rouletteRoundId || nextId('rh'));
      await historyDoc.set({
        roundNumber: state.currentRound,
        sliceId: r.slice.id,
        label: `${r.slice.label} (${r.miniGame})`,
        multiplier: 'mini',
      });
      await gameRef.update({
        rouletteOpen: false,
        rouletteSpinning: false,
        rouletteResult: updatedResult,
      });
      await log('roulette_result',
        `Round ${state.currentRound}: ${r.slice.label} (${r.miniGame}) complete`);
    } else {
      await gameRef.update({ rouletteResult: updatedResult });
    }
  }

  function registerLivePlayer(playerId) { state.livePlayerIds.add(playerId); }
  function unregisterLivePlayer(playerId) { state.livePlayerIds.delete(playerId); }

  // ══════════════════════════════════════════════════════════
  // Admin: round transitions
  // ══════════════════════════════════════════════════════════

  async function adminStartNewRound(roundNum) {
    if (!_isServer && !_isAdmin) return;

    const batch = db.batch();

    // Credit drop for all players (skip hidden server account)
    for (const p of state.players) {
      if (p.hidden) continue;
      if (roundNum >= (p.joinedRound || 0)) {
        batch.update(playersRef.doc(p.id), {
          balance: firebase.firestore.FieldValue.increment(state.autoSipsPerRound),
        });
        pushToastTo(p.id, { icon: '+', text: `+${state.autoSipsPerRound} sips dropped (Round ${roundNum})` });
      }
    }

    // Open new roulette window
    const closeTime = firebase.firestore.Timestamp.fromMillis(
      (state.gameStartedAtVirtual + (roundNum - 1) * ROUND_LEN + BET_WINDOW_LEN) * 1000
    );
    const newRoundId = nextId('rr');

    batch.update(gameRef, {
      currentRound: roundNum,
      sipsThisRound: {},
      rouletteOpen: !state.rouletteDisabled,
      rouletteSpinning: false,
      rouletteResult: null,
      rouletteRoundId: newRoundId,
      rouletteBetsCloseAt: closeTime,
    });

    // Clear previous roulette bets
    const oldBets = await rouletteBetsRef.get();
    for (const doc of oldBets.docs) {
      batch.delete(doc.ref);
    }

    await batch.commit();

    await log('credit_drop', `Round ${roundNum} — everyone got +${state.autoSipsPerRound} sips automatically`);
    await log('round_start', `Wheel betting is open for 5 minutes — place your bets`);
  }

  // ══════════════════════════════════════════════════════════
  // Admin: slices / game control
  // ══════════════════════════════════════════════════════════

  async function updateSlice(id, patch) {
    const slices = state.rouletteSlices.map(s =>
      s.id === id ? { ...s, ...patch } : s
    );
    await gameRef.update({ rouletteSlices: slices });
  }

  async function addSlice() {
    const newSlice = {
      id: nextId('s'), label: 'New Slice', type: 'multiplier', multiplier: 1, weight: 1, color: '#9DAE94',
    };
    await gameRef.update({
      rouletteSlices: firebase.firestore.FieldValue.arrayUnion(newSlice),
    });
  }

  async function removeSlice(id) {
    const slices = state.rouletteSlices.filter(s => s.id !== id);
    await gameRef.update({ rouletteSlices: slices });
  }

  async function setGameStatus(s) {
    await gameRef.update({ status: s });
  }

  async function broadcastMessage(message) {
    if (!message || !message.trim()) return;
    await log('admin_broadcast', message.trim());
  }

  async function setRouletteDisabled(disabled) {
    const updates = { rouletteDisabled: disabled };
    // If disabling, also close the current betting window
    if (disabled) {
      updates.rouletteOpen = false;
      updates.rouletteSpinning = false;
      updates.rouletteResult = null;
    }
    await gameRef.update(updates);
    await log('admin_broadcast', disabled ? 'Russell disabled the roulette wheel' : 'Russell re-enabled the roulette wheel — it will open next round');
  }

  async function startGame() {
    const now = Date.now() / 1000;
    const closeTime = firebase.firestore.Timestamp.fromMillis((now + BET_WINDOW_LEN) * 1000);
    const roundId = nextId('rr');

    const batch = db.batch();

    batch.update(gameRef, {
      status: 'active',
      startedAt: firebase.firestore.Timestamp.fromMillis(now * 1000),
      currentRound: 1,
      sipsThisRound: {},
      rouletteOpen: true,
      rouletteSpinning: false,
      rouletteResult: null,
      rouletteRoundId: roundId,
      rouletteBetsCloseAt: closeTime,
    });

    // Auto credit drop for all players (skip hidden server account)
    for (const p of state.players) {
      if (p.hidden) continue;
      batch.update(playersRef.doc(p.id), {
        balance: firebase.firestore.FieldValue.increment(state.autoSipsPerRound),
        joinedRound: Math.min(p.joinedRound || 0, 1),
      });
      pushToastTo(p.id, { icon: '🥂', text: `Game started! +${state.autoSipsPerRound} sips` });
    }

    await batch.commit();
    await log('game_start', `Russell started the game — Round 1 begins, wheel betting open for 5 min`);
    await log('credit_drop', `Round 1 — everyone got +${state.autoSipsPerRound} sips automatically`);
  }

  async function resetToWaiting() {
    await gameRef.update({
      status: 'waiting',
      currentRound: 0,
      rouletteOpen: false,
      rouletteResult: null,
      rouletteSpinning: false,
      sipsThisRound: {},
    });
    // Clear roulette bets
    const betsSnap = await rouletteBetsRef.get();
    const batch = db.batch();
    betsSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  async function restartGame() {
    // Full reset: clear all bets, roulette, activity, transfers, sip requests,
    // reset all player balances to 0, set game back to 'waiting'.
    const batch = db.batch();

    // Reset game doc
    batch.update(gameRef, {
      status: 'waiting',
      startedAt: null,
      currentRound: 0,
      rouletteOpen: false,
      rouletteSpinning: false,
      rouletteResult: null,
      rouletteRoundId: null,
      rouletteBetsCloseAt: null,
      sipsThisRound: {},
      rouletteSlices: DEFAULT_SLICES,
    });

    // Reset all player balances
    for (const p of state.players) {
      batch.update(playersRef.doc(p.id), { balance: 0 });
    }

    await batch.commit();

    // Delete subcollection documents in batches
    const collections = [rouletteBetsRef, rouletteHistoryRef, activityRef, transfersRef, sipRequestsRef, betsRef];
    for (const collRef of collections) {
      const snap = await collRef.get();
      if (snap.empty) continue;
      const delBatch = db.batch();
      snap.forEach(doc => delBatch.delete(doc.ref));
      await delBatch.commit();
    }

    await log('game_start', 'Game has been reset by Russell. Waiting to start again.');
  }

  async function adjustBalance(playerId, delta) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return;
    const newBalance = Math.max(0, p.balance + delta);
    await playersRef.doc(playerId).update({ balance: newBalance });
  }

  async function fastForwardToNextRound() {
    // Directly trigger the next round (works from any admin, no server dependency)
    const nextRound = (state.currentRound || 0) + 1;
    // Adjust startedAt so the game loop's math stays consistent
    const now = Date.now() / 1000;
    const newStart = now - (nextRound - 1) * ROUND_LEN;
    await gameRef.update({
      startedAt: firebase.firestore.Timestamp.fromMillis(newStart * 1000),
    });
    // Directly trigger the round transition
    await adminStartNewRound(nextRound);
  }

  async function spinWheelNow() {
    // Admin manually triggers the spin — close betting and spin immediately
    await gameRef.update({
      rouletteOpen: false,
      rouletteBetsCloseAt: firebase.firestore.Timestamp.fromMillis(Date.now()),
    });
    await executeRouletteSpin();
    // Auto-finalize after animation duration — admin may not be on the Wheel tab
    console.log('[SPIN] Will auto-finalize in 6.5 seconds');
    setTimeout(() => {
      console.log('[SPIN] Auto-finalize timer fired');
      finalizeRouletteSpin()
        .then(() => console.log('[SPIN] Auto-finalize complete'))
        .catch(e => console.error('[SPIN] Auto-finalize FAILED:', e));
    }, 6500);
  }

  // ══════════════════════════════════════════════════════════
  // Getters
  // ══════════════════════════════════════════════════════════

  function getPlayer(id) { return state.players.find(p => p.id === id); }

  function timeToNextRound() {
    const next = state.currentRound * ROUND_LEN;
    const elapsed = (Date.now() / 1000) - state.gameStartedAtVirtual;
    return Math.max(0, next - elapsed);
  }

  function getMyRouletteBets(playerId) {
    return state.rouletteBets.filter(b => b.playerId === playerId);
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
    setGameStatus, startGame, resetToWaiting, restartGame, adjustBalance, broadcastMessage, setRouletteDisabled,
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
  const diff = Math.max(0, (Date.now() / 1000) - _vtime);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
function fmtActivityAge(entry) {
  if (entry._vtime != null) return fmtAgo(entry._vtime);
  return '';
}

Object.assign(window, { BroStore, useStore, fmtMSS, fmtAgo, fmtActivityAge });
