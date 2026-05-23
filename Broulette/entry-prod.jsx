// entry-prod.jsx — Production entry point (no phone frames, no tweaks panel)
// Renders BroApp directly into the page, full-screen mobile.

const rootEl = document.getElementById('root');
ReactDOM.createRoot(rootEl).render(<BroApp />);
