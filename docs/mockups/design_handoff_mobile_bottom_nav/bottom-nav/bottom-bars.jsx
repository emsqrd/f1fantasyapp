// ───────────────────────────────────────────────────────────────────────────
// MobileBottomNav — the mobile presentation of the nav definition.
// Edge-to-edge, solid, hairline top border; active tab = primary color +
// heavier icon/label. Positioned absolute at the bottom of the PhoneFrame so
// screen content scrolls underneath. Consumes the single useNavDestinations()
// hook, so with no team it renders Home only without any extra logic.
// ───────────────────────────────────────────────────────────────────────────

const MUTED = 'var(--muted-foreground)';
const PRIM = 'var(--primary)';

// iOS home indicator (the pill at the very bottom edge)
function HomeIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '7px 0 8px' }}>
      <div style={{ width: 132, height: 5, borderRadius: 3, background: 'var(--foreground)', opacity: 0.22 }} />
    </div>
  );
}

const barBase = {
  position: 'absolute', left: 0, right: 0, bottom: 0,
  background: 'var(--background)', borderTop: '1px solid var(--border)',
};
const rowBase = { display: 'flex', alignItems: 'stretch', padding: '6px 6px 2px' };
const tabBtn = {
  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 4, minHeight: 46, padding: '4px 0', border: 'none', background: 'transparent', cursor: 'pointer',
  fontFamily: 'inherit',
};

function BottomNav({ hasTeam = true, current = 'home', onTab }) {
  const items = useNavDestinations(hasTeam, current);
  return (
    <nav style={barBase}>
      <div style={rowBase}>
        {items.map((it) => (
          <button key={it.key} onClick={() => onTab && onTab(it.key)} style={tabBtn}>
            <span style={{ color: it.isActive ? PRIM : MUTED, display: 'inline-flex', transition: 'color .18s' }}>
              <Icon name={it.icon} size={23} strokeWidth={it.isActive ? 2.3 : 2} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: it.isActive ? 650 : 500, color: it.isActive ? PRIM : MUTED, lineHeight: 1, whiteSpace: 'nowrap' }}>{it.short}</span>
          </button>
        ))}
      </div>
      <HomeIndicator />
    </nav>
  );
}

Object.assign(window, { BottomNav });
