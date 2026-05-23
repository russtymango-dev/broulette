// entry.jsx — Mount into the page: canvas with iOS + Android frames + tweaks

const { useState: useES, useEffect: useEE } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "default",
  "speed": 1
}/*EDITMODE-END*/;

const SPEED_OPTIONS = [
  { value: 1,    label: '1× real' },
  { value: 60,   label: '60×' },
  { value: 600,  label: '600×' },
  { value: 3600, label: '1 hr/sec' },
];

function Root() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEE(() => { document.documentElement.dataset.theme = t.theme; }, [t.theme]);
  useEE(() => { BroStore.setSpeed(t.speed || 1); }, [t.speed]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="phones" title="Broulette — Izzy & Kyle's wedding" subtitle="One website. Two phones. Same game state.">
          <DCArtboard id="ios" label="iOS — Russell (admin)" width={402} height={874}>
            <IOSDevice width={402} height={874}>
              {/* iOS status bar + dynamic island are position:absolute and paint
                  over the top ~62px of the content area; home indicator (34px)
                  sits at the bottom. Reserve both so our header/tab-bar don't
                  collide with them. */}
              <div style={{ height: '100%', paddingTop: 62, paddingBottom: 34, boxSizing: 'border-box' }}>
                <BroApp frameId="ios" />
              </div>
            </IOSDevice>
          </DCArtboard>
          <DCArtboard id="android" label="Android — Izzy (player)" width={412} height={892}>
            <AndroidDevice width={412} height={892}>
              <BroApp frameId="android" />
            </AndroidDevice>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Look" />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={[
            { value: 'default',  label: 'Cream' },
            { value: 'vineyard', label: 'Vine' },
            { value: 'midnight', label: 'Night' },
          ]}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakSection label="Game" />
        <TweakSelect
          label="Time speed"
          value={t.speed}
          options={SPEED_OPTIONS}
          onChange={(v) => setTweak('speed', Number(v))}
        />
        <div style={{
          fontSize: 11, color: 'rgba(41,38,27,.55)',
          background: 'rgba(0,0,0,.04)', padding: '8px 10px', borderRadius: 8, lineHeight: 1.4,
        }}>
          Game starts every 30 min. Speed it up to watch credit drops and the wheel opening.
        </div>
        <TweakButton label="Next round now" onClick={() => {
          BroStore.fastForwardToNextRound();
        }} />
        <TweakButton label="Spin the wheel now" onClick={() => {
          BroStore.spinWheelNow();
        }} />
        <TweakButton label="Reset to pre-game" onClick={() => {
          BroStore.resetToWaiting();
        }} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
