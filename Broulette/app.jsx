// app.jsx — Per-frame app shell: holds local nav state, mounts screens

const { useState: useAppS, useEffect: useAppE } = React;

function BroApp({ frameId }) {
  const store = useStore();
  const [me, setMe] = useAppS(null);
  const [tab, setTabRaw] = useAppS('home');
  const [detailId, setDetailId] = useAppS(null);
  const [sheet, setSheet] = useAppS(null); // 'send' | 'create' | 'debt' | null
  const [rulesShown, setRulesShown] = useAppS(false);

  // Setting tab also accepts options like { detailId }
  const setTab = (t, opts = {}) => {
    setTabRaw(t);
    if (opts.detailId != null) setDetailId(opts.detailId);
    else if (t !== 'bets') setDetailId(null);
  };

  // Show rules dialog every time the user lands on the dashboard fresh
  useAppE(() => {
    if (me && !rulesShown) {
      // small delay so the dashboard mounts behind it
      const id = setTimeout(() => setRulesShown(true), 200);
      return () => clearTimeout(id);
    }
  }, [me]);

  // Track live players (those signed in on a phone) so the store can tell
  // the difference between a real player and a bot when auto-resolving mini-games.
  useAppE(() => {
    if (!me) return;
    store.registerLivePlayer(me.id);
    return () => store.unregisterLivePlayer(me.id);
  }, [me, store]);

  if (!me) {
    return <LoginScreen frameId={frameId} onLogin={(p) => { setMe(p); setRulesShown(false); }} />;
  }

  // Refresh `me` from store on every render so balance stays live
  const liveMe = store.getPlayer(me.id) || me;

  // Game not started yet → show lobby (admin gets the START button)
  if (store.state.gameStatus === 'waiting') {
    return <WaitingLobbyScreen me={liveMe} onLogout={() => setMe(null)} />;
  }

  return (
    <div className="app">
      <ToastStack playerId={liveMe.id} store={store} />
      <div className="app-scroll">
        {tab === 'home' && (
          <DashboardScreen
            me={liveMe} setTab={setTab}
            openSend={() => setSheet('send')}
            openCreateBet={() => setSheet('create')}
            openDebt={() => setSheet('debt')}
            onLogout={() => setMe(null)}
          />
        )}
        {tab === 'bets' && (
          <BetsScreen
            me={liveMe}
            openCreateBet={() => setSheet('create')}
            detailId={detailId}
            setDetailId={setDetailId}
          />
        )}
        {tab === 'wheel' && <RouletteScreen me={liveMe} />}
        {tab === 'feed' && <ActivityScreen />}
        {tab === 'top' && <LeaderboardScreen me={liveMe} />}
        {tab === 'admin' && liveMe.isAdmin && <AdminScreen me={liveMe} />}
      </div>
      <TabBar tab={tab} setTab={setTab} isAdmin={liveMe.isAdmin} />

      <SendDrinksSheet open={sheet === 'send'} onClose={() => setSheet(null)} me={liveMe} />
      <CreateBetSheet  open={sheet === 'create'} onClose={() => setSheet(null)} me={liveMe} />
      <DebtSheet       open={sheet === 'debt'} onClose={() => setSheet(null)} me={liveMe} />
      <RulesDialog     open={rulesShown} onClose={() => setRulesShown(false)} />
    </div>
  );
}

Object.assign(window, { BroApp });
