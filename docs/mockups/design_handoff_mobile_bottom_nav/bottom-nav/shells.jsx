// ───────────────────────────────────────────────────────────────────────────
// Device shells: PhoneFrame + MobileTopBar (with relocated account menu) and
// the DESKTOP sidebar reference (unchanged — stays exactly as shipped).
// ───────────────────────────────────────────────────────────────────────────

// ---- iOS-ish status bar -----------------------------------------------------
function StatusBar() {
  return (
    <div style={{
      height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 22px 0 26px', color: 'var(--foreground)', fontSize: 14, fontWeight: 600,
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" opacity="0.35" /></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M8 2.2c2 0 3.8.8 5.2 2.1l1.1-1.2A9 9 0 0 0 8 .4 9 9 0 0 0 1.7 3.1l1.1 1.2A7.4 7.4 0 0 1 8 2.2Z" /><path d="M8 5.5c1.1 0 2.1.4 2.9 1.2l1.1-1.2A6 6 0 0 0 8 3.8a6 6 0 0 0-4 1.7l1.1 1.2A4.3 4.3 0 0 1 8 5.5Z" /><path d="M8 8.6 9.8 6.8A3 3 0 0 0 8 6.2a3 3 0 0 0-1.8.6L8 8.6Z" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" /><rect x="23" y="3.5" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.4" /></svg>
      </div>
    </div>
  );
}

// ---- Mobile top bar — brand + account menu trigger --------------------------
// Account (profile / theme / sign out) lives HERE on mobile, per the issue.
function MobileTopBar({ accountOpen, onAccount, theme, onTheme, blur }) {
  return (
    <header style={{
      height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', borderBottom: '1px solid var(--border)',
      background: blur ? 'color-mix(in oklab, var(--background) 80%, transparent)' : 'var(--background)',
      backdropFilter: blur ? 'saturate(180%) blur(12px)' : 'none', position: 'relative', zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--primary)', display: 'inline-flex' }}><Icon name="trophy" size={21} /></span>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>F1 Fantasy</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={onAccount} aria-label="Account menu" style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', borderRadius: 999 }}>
          <F1Avatar size={32} ring={accountOpen} />
        </button>
      </div>
    </header>
  );
}

// ---- Account popover (anchored under the top-bar avatar) --------------------
function AccountPopover({ theme, onTheme, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, animation: 'f1-fade .15s ease' }} />
      <div style={{
        position: 'absolute', top: 52 + 44 + 6, right: 12, width: 252, zIndex: 41,
        background: 'var(--popover, var(--card))', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', animation: 'f1-pop .16s cubic-bezier(.2,.7,.3,1)',
      }}>
        <AccountMenu theme={theme} onTheme={onTheme} />
      </div>
    </>
  );
}

// ---- PhoneFrame — themed device shell ---------------------------------------
// Renders status bar + top bar + scrolling Home + the bottom bar passed in.
function PhoneFrame({
  theme = 'dark', hasTeam = true, width = 390, height = 800,
  bottomBar, accountOpen, onAccount, onTheme, blurTop, scrollTop = 0, screen, bottomPad = 116,
}) {
  return (
    <div className={`f1 f1-${theme}`} style={{
      width, height, background: 'var(--background)', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <StatusBar />
      <MobileTopBar accountOpen={accountOpen} onAccount={onAccount} theme={theme} onTheme={onTheme} blur={blurTop} />
      {/* Scroll area — content scrolls under the pinned bottom bar */}
      <div style={{ flex: 1, position: 'relative', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <div>
          {screen || <HomeScreen hasTeam={hasTeam} />}
          <div style={{ height: bottomPad }} />
        </div>
      </div>
      {bottomBar}
      {accountOpen && <AccountPopover theme={theme} onTheme={onTheme} onClose={onAccount} />}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// DESKTOP reference — sidebar stays exactly as it is today.
// ───────────────────────────────────────────────────────────────────────────
function DesktopSidebar({ hasTeam, current }) {
  const items = useNavDestinations(hasTeam, current);
  return (
    <aside style={{
      width: 248, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column', padding: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px' }}>
        <span style={{ color: 'var(--sidebar-foreground)', display: 'inline-flex' }}><Icon name="trophy" size={22} /></span>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--sidebar-foreground)' }}>F1 Fantasy Sports</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8, flex: 1 }}>
        {items.map((it) => (
          <div key={it.key} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 'calc(var(--radius) - 2px)', cursor: 'pointer',
            background: it.isActive ? 'var(--sidebar-accent)' : 'transparent',
            color: it.isActive ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)',
            fontSize: 13.5, fontWeight: it.isActive ? 600 : 500,
          }}>
            <Icon name={it.icon} size={17} />
            <span style={{ flex: 1 }}>{it.title}</span>
          </div>
        ))}
      </nav>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 'calc(var(--radius) - 2px)',
        cursor: 'pointer', background: 'transparent',
      }}>
        <F1Avatar size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sidebar-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{F1_PROFILE.displayName}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{F1_PROFILE.email}</div>
        </div>
        <span style={{ color: 'var(--muted-foreground)' }}><Icon name="chevronUp" size={15} /></span>
      </div>
    </aside>
  );
}

// Desktop home main content (compact, just enough to read as "the app").
function DesktopMain({ hasTeam }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--background)', minWidth: 0 }}>
      <header style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--muted-foreground)' }}><Icon name="panelLeft" size={18} /></span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <h1 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: 'var(--foreground)' }}>Home</h1>
      </header>
      <div style={{ flex: 1, overflow: 'hidden', padding: '24px 28px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <HomeScreen hasTeam={hasTeam} desktop />
        </div>
      </div>
    </div>
  );
}

function DesktopFrame({ theme = 'dark', hasTeam = true, width = 1040, height = 660 }) {
  return (
    <div className={`f1 f1-${theme}`} style={{ width, height, background: 'var(--sidebar)', display: 'flex', overflow: 'hidden' }}>
      <DesktopSidebar hasTeam={hasTeam} current="home" />
      <DesktopMain hasTeam={hasTeam} />
    </div>
  );
}

Object.assign(window, { PhoneFrame, MobileTopBar, DesktopSidebar, DesktopFrame });
