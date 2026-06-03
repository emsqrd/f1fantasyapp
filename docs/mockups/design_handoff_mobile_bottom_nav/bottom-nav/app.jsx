// ───────────────────────────────────────────────────────────────────────────
// Canvas composition — the chosen direction only:
//   · Edge-solid bottom bar (mobile)         · desktop keeps the sidebar
//   · No team → Home only (one nav definition renders Home-only in both)
//   · Account menu (profile / theme / sign-out) lives in the mobile top bar
// ───────────────────────────────────────────────────────────────────────────
const {
  DesignCanvas, DCSection, DCArtboard, DCPostIt,
  PhoneFrame, DesktopFrame, BottomNav, useNavDestinations,
  HomeScreen, BrowseScreen, CreateTeamScreen,
} = window;

// ---- Placeholder screens for the has-team destinations (visual stand-ins) ---
function Placeholder({ title, sub }) {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '4px 0 14px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>{title}</h2>
      <div style={{
        height: 320, borderRadius: 'var(--radius)', border: '1px dashed var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        background: 'repeating-linear-gradient(135deg, transparent, transparent 9px, color-mix(in oklab, var(--muted-foreground) 8%, transparent) 9px, color-mix(in oklab, var(--muted-foreground) 8%, transparent) 10px)',
      }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: 'var(--muted-foreground)', maxWidth: 200 }}>{sub}</span>
      </div>
    </div>
  );
}

// Routes a tab key to its screen. No-team only ever reaches 'home' or 'create'.
function TabScreen({ current, hasTeam, onCreate, onCreateSubmit }) {
  if (current === 'create') return <CreateTeamScreen onSubmit={onCreateSubmit} />;
  if (current === 'home') return <HomeScreen hasTeam={hasTeam} onCreate={onCreate} />;
  if (current === 'browse') return <BrowseScreen />;
  const map = {
    team: ['My Team', '[ team roster · 5 drivers + 2 constructors ]'],
    leagues: ['My Leagues', '[ league standings table ]'],
  };
  const [t, s] = map[current] || ['', ''];
  return <Placeholder title={t} sub={s} />;
}

// ---- Interactive hero -------------------------------------------------------
function HeroPhone() {
  const [current, setCurrent] = React.useState('home');
  const [theme, setTheme] = React.useState('dark');
  const [hasTeam, setHasTeam] = React.useState(true);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false); // Create Team page overlay

  // When team state flips, keep the active tab valid and leave the create page.
  React.useEffect(() => {
    const valid = useNavDestinations(hasTeam, current).some((i) => i.key === current);
    if (!valid) setCurrent('home');
    setShowCreate(false);
  }, [hasTeam]);

  const resolvedTheme = theme === 'system' ? 'dark' : theme;
  const goTab = (k) => { setShowCreate(false); setCurrent(k); };

  // One bar, always edge-solid. With no team the nav definition yields Home
  // only, so the same component renders the Home-only bar automatically.
  const bottomBar = (
    <BottomNav hasTeam={hasTeam} current={showCreate ? null : current} onTab={goTab} />
  );

  const Chip = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      border: `1px solid ${active ? '#c96442' : 'rgba(0,0,0,.14)'}`,
      background: active ? '#c96442' : '#fff', color: active ? '#fff' : '#4a4036',
      borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .12s',
    }}>{children}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 390, margin: '6px auto 0' }}>
      <div style={{ borderRadius: 30, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.14)', border: '1px solid rgba(0,0,0,.08)' }}>
        <PhoneFrame
          theme={resolvedTheme}
          hasTeam={hasTeam}
          width={390}
          height={800}
          bottomBar={bottomBar}
          bottomPad={116}
          screen={<TabScreen
            current={showCreate ? 'create' : current}
            hasTeam={hasTeam}
            onCreate={() => setShowCreate(true)}
            onCreateSubmit={() => { setShowCreate(false); setHasTeam(true); setCurrent('home'); }}
          />}
          accountOpen={accountOpen}
          onAccount={() => setAccountOpen((o) => !o)}
          onTheme={setTheme}
        />
      </div>

      {/* prototype control (not part of the product UI) */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a8f82', marginBottom: 6 }}>Nav state</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={hasTeam} onClick={() => setHasTeam(true)}>Has team</Chip>
              <Chip active={!hasTeam} onClick={() => setHasTeam(false)}>No team</Chip>
            </div>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#9a8f82', maxWidth: 168, textAlign: 'right' }}>
            {hasTeam
              ? 'Tap tabs · tap the avatar for the account menu'
              : 'No team → Home only. Create a team from the Home hero.'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Account-menu demo phone (popover open, closeable) ----------------------
function AccountDemoPhone({ theme }) {
  const [open, setOpen] = React.useState(true);
  const [th, setTh] = React.useState(theme);
  return (
    <PhoneFrame
      theme={th} hasTeam width={390} height={800}
      bottomBar={<BottomNav hasTeam current="home" />}
      accountOpen={open}
      onAccount={() => setOpen((o) => !o)}
      onTheme={setTh}
    />
  );
}

// ---- Static phone (for the documentation artboards) -------------------------
function StaticPhone({ theme, hasTeam = true, current = 'home' }) {
  return (
    <PhoneFrame
      theme={theme} hasTeam={hasTeam} width={390} height={800}
      bottomBar={<BottomNav hasTeam={hasTeam} current={current} />}
      screen={<TabScreen current={current} hasTeam={hasTeam} />}
    />
  );
}

// ---- App --------------------------------------------------------------------
function App() {
  return (
    <DesignCanvas>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <DCSection id="hero" title="Mobile bottom nav — edge solid" subtitle="Tap the tabs, open the account menu, and toggle the team state. Desktop keeps the sidebar, unchanged.">
        <DCArtboard id="hero-phone" label="Interactive · iPhone" width={430} height={935} style={{ background: 'transparent', boxShadow: 'none', overflow: 'visible' }}>
          <HeroPhone />
        </DCArtboard>
        <DCArtboard id="desk-dark" label="Desktop · 1280 — sidebar (dark)" width={1040} height={660}>
          <DesktopFrame theme="dark" hasTeam />
        </DCArtboard>
        <DCArtboard id="desk-light" label="Desktop · 1280 — sidebar (light)" width={1040} height={660}>
          <DesktopFrame theme="light" hasTeam />
        </DCArtboard>
        <DCPostIt id="note-hook" top={690} left={505} rotate={2.5} width={210}>
          One <b>useNavDestinations()</b> hook is the source of truth. The desktop sidebar and the mobile bottom bar are two thin presentations of it — add a destination once, it shows in both.
        </DCPostIt>
      </DCSection>

      {/* ── No-team state ──────────────────────────────────────────────── */}
      <DCSection id="noteam" title="No team → Home only" subtitle="With no team there's one destination, so the same nav definition renders Home only on both viewports. Create Team is reached from the Home hero, never the nav.">
        <DCArtboard id="nt-mobile-d" label="Mobile · Home only (dark)" width={390} height={800}><StaticPhone theme="dark" hasTeam={false} /></DCArtboard>
        <DCArtboard id="nt-mobile-l" label="Mobile · Home only (light)" width={390} height={800}><StaticPhone theme="light" hasTeam={false} /></DCArtboard>
        <DCArtboard id="nt-desk" label="Desktop · sidebar, Home only" width={1040} height={660}><DesktopFrame theme="dark" hasTeam={false} /></DCArtboard>
        <DCArtboard id="nt-create" label="Create Team (from the Home hero)" width={390} height={800}><StaticPhone theme="dark" hasTeam={false} current="create" /></DCArtboard>
        <DCPostIt id="note-noteam" top={-8} left={812} rotate={-2} width={236}>
          <b>Home only, not hidden behind a hamburger.</b> The one place a no-team user can go is always visible.<br /><br />
          The <b>Create team</b> button in the Home hero opens the Create Team page; once a team exists, My Team / Leagues / Browse appear in both nav presentations.
        </DCPostIt>
      </DCSection>

      {/* ── Account menu in the top bar ────────────────────────────────── */}
      <DCSection id="account" title="Account menu — in the top bar" subtitle="Profile, theme and sign-out are not bottom-bar tabs. On mobile they live in the top-right of the header, mirroring the sidebar footer on desktop.">
        <DCArtboard id="acc-dark" label="Account open · dark" width={390} height={800}><AccountDemoPhone theme="dark" /></DCArtboard>
        <DCArtboard id="acc-light" label="Account open · light" width={390} height={800}><AccountDemoPhone theme="light" /></DCArtboard>
        <DCPostIt id="note-account" top={70} left={812} rotate={-2.5} width={210}>
          The bottom bar holds <b>destinations only</b>. Account actions sit in the top-right — tap the avatar to open the menu.
        </DCPostIt>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
