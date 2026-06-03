// ───────────────────────────────────────────────────────────────────────────
// Shared chrome for the F1 Fantasy mobile-nav exploration.
// Tokens are lifted verbatim from web/src/index.css. The nav definition lives
// in ONE place (useNavDestinations) and is consumed by both the desktop
// sidebar and every mobile bottom-bar variant — the architectural point of
// the issue.
// ───────────────────────────────────────────────────────────────────────────

// ---- Token injection (exact values from src/index.css) ----------------------
if (typeof document !== 'undefined' && !document.getElementById('f1-tokens')) {
  const s = document.createElement('style');
  s.id = 'f1-tokens';
  s.textContent = `
  .f1 {
    --radius: 0.65rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .f1 *, .f1 *::before, .f1 *::after { box-sizing: border-box; }
  .f1-light {
    --background:#ffffff; --foreground:#09090b;
    --card:#ffffff; --card-foreground:#09090b;
    --primary:#1447e6; --primary-foreground:#eff6ff;
    --secondary:#f4f4f5; --secondary-foreground:#18181b;
    --muted:#f4f4f5; --muted-foreground:#71717b;
    --accent:#f4f4f5; --accent-foreground:#18181b;
    --border:#e4e4e7; --input:#e4e4e7;
    --sidebar:#fafafa; --sidebar-foreground:#09090b;
    --sidebar-accent:#f4f4f5; --sidebar-accent-foreground:#18181b;
    --sidebar-border:#e4e4e7;
    --delta-up:#16a34a; --delta-down:#dc2626; --delta-flat:#71717a;
    --shadow: 0 1px 3px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.06);
    --barshadow: 0 -1px 0 var(--border), 0 -8px 24px rgba(0,0,0,.05);
  }
  .f1-dark {
    --background:#09090b; --foreground:#fafafa;
    --card:#18181b; --card-foreground:#fafafa;
    --primary:#2b7fff; --primary-foreground:#eff6ff;
    --secondary:#27272a; --secondary-foreground:#fafafa;
    --muted:#27272a; --muted-foreground:#9f9fa9;
    --accent:#27272a; --accent-foreground:#fafafa;
    --border:#ffffff1a; --input:#ffffff26;
    --sidebar:#18181b; --sidebar-foreground:#fafafa;
    --sidebar-accent:#27272a; --sidebar-accent-foreground:#fafafa;
    --sidebar-border:#ffffff1a;
    --delta-up:#4ade80; --delta-down:#f87171; --delta-flat:#9f9fa9;
    --shadow: 0 1px 3px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5);
    --barshadow: 0 -1px 0 var(--sidebar-border), 0 -10px 30px rgba(0,0,0,.45);
  }
  .f1-screenfont { font-variant-numeric: tabular-nums; }
  @keyframes f1-pop { from { opacity:0; transform: translateY(6px) scale(.98); } to { opacity:1; transform:none; } }
  @keyframes f1-fade { from { opacity:0; } to { opacity:1; } }
  `;
  document.head.appendChild(s);
}

// ---- Mock data --------------------------------------------------------------
const F1_PROFILE = { displayName: 'Daniel Reuben', email: 'daniel.r@gmail.com', initials: 'DR' };
const F1_TEAM = { name: 'Scuderia Latte' };
const F1_RACE = {
  round: 9, name: 'Canadian Grand Prix', location: 'Montréal', country: 'Canada',
  date: 'Jun 15', d: '02', h: '14', m: '06',
};
const F1_LASTRACE = { name: 'Spanish Grand Prix', score: 142 };
const F1_SEASON = 1286;
const F1_LEAGUES = [
  { name: 'Apex Predators', pos: 3, teams: 24 },
  { name: 'Paddock Club', pos: 1, teams: 12 },
  { name: 'Lights Out GP', pos: 7, teams: 31 },
];

// ---- THE single nav definition (source of truth) ----------------------------
// Home is always present; the other destinations exist only once the user has a
// team. Desktop sidebar AND mobile bottom bar both consume this one hook — so
// with no team both render Home only, and adding a destination here surfaces it
// in both. "Create Team" is an ACTION (the Home hero), never a destination.
function useNavDestinations(hasTeam, current) {
  const items = [{ key: 'home', title: 'Home', short: 'Home', icon: 'home', path: '/' }];
  if (hasTeam) {
    items.push(
      { key: 'team', title: 'My Team', short: 'Team', icon: 'users', path: '/my-team' },
      { key: 'leagues', title: 'My Leagues', short: 'Leagues', icon: 'gantt', path: '/leagues' },
      { key: 'browse', title: 'Browse Leagues', short: 'Browse', icon: 'search', path: '/browse-leagues' },
    );
  }
  return items.map((it) => ({ ...it, isActive: it.key === current }));
}

// Matches the app's shadcn <Avatar h-8 w-8 rounded-lg> with the <CircleUser>
// fallback glyph on a muted background (no uploaded image in these mocks).
function F1Avatar({ size = 32, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 'calc(var(--radius) - 2px)',
      background: 'var(--muted)', color: 'var(--muted-foreground)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: ring ? '0 0 0 2px var(--background), 0 0 0 3.5px var(--primary)' : 'none',
    }}>
      <Icon name="user" size={Math.round(size * 0.72)} strokeWidth={1.8} />
    </div>
  );
}

// ---- Shared account-menu body (used by mobile top bar + desktop footer) -----
function AccountMenu({ theme, onTheme, compact }) {
  const Row = ({ children, danger, onClick }) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6,
      padding: '8px 10px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500,
      color: danger ? 'var(--foreground)' : 'var(--foreground)',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      {children}
    </button>
  );
  const themes = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'monitor', 'System']];
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
        <F1Avatar size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{F1_PROFILE.displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{F1_PROFILE.email}</div>
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
      <Row><Icon name="badgeCheck" size={16} /> My Account</Row>
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
      <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>Theme</div>
      {/* Segmented theme control — same three options as the sidebar dropdown */}
      <div style={{ display: 'flex', gap: 4, padding: '2px 6px 6px' }}>
        {themes.map(([val, ic, label]) => {
          const on = theme === val;
          return (
            <button key={val} onClick={() => onTheme && onTheme(val)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
              background: on ? 'color-mix(in oklab, var(--primary) 12%, transparent)' : 'transparent',
              color: on ? 'var(--primary)' : 'var(--muted-foreground)',
              borderRadius: 'calc(var(--radius) - 3px)', padding: '7px 4px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
            }}>
              <Icon name={ic} size={15} /> {label}
            </button>
          );
        })}
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
      <Row danger><Icon name="logout" size={16} /> Sign Out</Row>
    </div>
  );
}

// ---- Home screen content (mirrors Home.tsx) ---------------------------------
function Eyebrow({ children, primary }) {
  return (
    <p style={{
      margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase',
      color: primary ? 'color-mix(in oklab, var(--primary) 72%, var(--muted-foreground))' : 'var(--muted-foreground)',
    }}>{children}</p>
  );
}

function Card({ children, style }) {
  return (
    <section style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 16, ...style,
    }}>{children}</section>
  );
}

function NextRaceCard({ desktop }) {
  const meta = (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: desktop ? 'row' : 'column', gap: desktop ? '0 12px' : '4px 0', alignItems: desktop ? 'center' : 'flex-start', fontSize: desktop ? 14 : 12, color: 'var(--muted-foreground)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="mapPin" size={14} /> {F1_RACE.location}, {F1_RACE.country}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="calendar" size={14} /> {F1_RACE.date}</span>
    </div>
  );

  const Seg = ({ v, u }) => (
    <span>{v}<span style={{ color: 'var(--muted-foreground)', fontSize: desktop ? 16 : 13, fontWeight: 600, marginLeft: 1 }}>{u}</span></span>
  );
  const countdown = (
    <div style={{
      textAlign: desktop ? 'right' : 'left',
      borderTop: desktop ? 'none' : '1px solid var(--border)',
      paddingTop: desktop ? 0 : 16,
      flexShrink: 0,
    }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Lineup locks in</p>
      <p className="f1-screenfont" style={{ margin: '4px 0 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: desktop ? 30 : 24, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
        <Seg v={F1_RACE.d} u="d" /> <Seg v={F1_RACE.h} u="h" /> <Seg v={F1_RACE.m} u="m" />
      </p>
    </div>
  );

  return (
    <Card style={{ padding: desktop ? 24 : 16 }}>
      <div style={{ display: 'flex', flexDirection: desktop ? 'row' : 'column', gap: desktop ? 24 : 16, alignItems: desktop ? 'center' : 'stretch', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'color-mix(in oklab, var(--primary) 70%, var(--muted-foreground))' }}>Round {F1_RACE.round} · Next up</p>
          <h2 style={{ margin: '4px 0 0', fontSize: desktop ? 28 : 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{F1_RACE.name}</h2>
          {meta}
        </div>
        {countdown}
      </div>
    </Card>
  );
}

function ScoreCard({ eyebrow, title, score }) {
  return (
    <Card style={{ padding: 16 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{eyebrow}</p>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <span className="f1-screenfont" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 24, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>
          {score.toLocaleString()}<span style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, marginLeft: 4 }}>pts</span>
        </span>
      </div>
    </Card>
  );
}

function LeaguesList({ desktop }) {
  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: desktop ? 18 : 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>My Leagues</h3>
      <button style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: desktop ? 14 : 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>View all →</button>
    </div>
  );

  if (desktop) {
    // Single bordered table: secondary header row + divided rows.
    return (
      <section>
        {header}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--card)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '10px 24px', background: 'var(--secondary)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
            <div>League</div>
            <div style={{ textAlign: 'right' }}>Pos</div>
          </div>
          {F1_LEAGUES.map((lg, i) => (
            <div key={lg.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 24px', borderTop: i ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{lg.name}</span>
              <span className="f1-screenfont" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16, fontWeight: 600, color: 'var(--foreground)', textAlign: 'right' }}>{lg.pos}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Mobile: each league is its own card, under a lightweight column header.
  return (
    <section>
      {header}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '0 16px 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        <div>League</div>
        <div style={{ textAlign: 'right' }}>Pos</div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {F1_LEAGUES.map((lg) => (
          <li key={lg.name}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12,
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: '12px 16px', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{lg.name}</span>
              <span className="f1-screenfont" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, fontWeight: 600, color: 'var(--foreground)', textAlign: 'right' }}>{lg.pos}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreateTeamHero({ desktop, onCreate }) {
  return (
    <Card style={{ padding: desktop ? 24 : 16 }}>
      <div style={{ display: 'flex', flexDirection: desktop ? 'row' : 'column', gap: desktop ? 24 : 16, alignItems: desktop ? 'center' : 'stretch', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: desktop ? 24 : 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>Get on the grid</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>Pick 5 drivers and 2 constructors with a $100M budget. Set a captain to earn 2× points on their race score.</p>
        </div>
        <button onClick={onCreate} style={{
          border: 'none', borderRadius: 'calc(var(--radius) - 2px)',
          background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '11px 20px',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          width: desktop ? 'auto' : '100%', whiteSpace: 'nowrap',
        }}>Create team</button>
      </div>
    </Card>
  );
}

function LeaguesNeedTeamNotice({ desktop }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
      padding: desktop ? 48 : 24,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: 384 }}>
        <div style={{ width: 40, height: 40, borderRadius: 'calc(var(--radius) - 2px)', background: 'var(--muted)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Icon name="gantt" size={24} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>Leagues unlock with a team</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--muted-foreground)' }}>You'll be able to join private leagues with friends or browse public ones.</div>
      </div>
    </div>
  );
}

// ---- Shared primary / secondary button --------------------------------------
function PrimaryButton({ children, subtle, full, onClick }) {
  return (
    <button onClick={onClick} style={{
      border: subtle ? '1px solid var(--border)' : 'none',
      background: subtle ? 'transparent' : 'var(--primary)',
      color: subtle ? 'var(--foreground)' : 'var(--primary-foreground)',
      borderRadius: 'calc(var(--radius) - 2px)', padding: '10px 18px',
      fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      width: full ? '100%' : 'auto', whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

// Browse Leagues — only reachable once the user has a team. Lists public
// leagues with a Join action.
const F1_PUBLIC = [
  { name: 'Global Championship', members: '48.2k', tag: 'Public' },
  { name: 'Rookies Welcome', members: '12.7k', tag: 'Beginner' },
  { name: 'Backmarkers United', members: '3.1k', tag: 'Casual' },
  { name: 'Podium Chasers', members: '9.8k', tag: 'Competitive' },
];
function BrowseScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 8px' }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>Browse Leagues</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'calc(var(--radius) - 2px)', padding: '9px 12px', color: 'var(--muted-foreground)' }}>
        <Icon name="search" size={16} />
        <span style={{ fontSize: 13.5 }}>Search public leagues</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {F1_PUBLIC.map((lg) => (
          <li key={lg.name} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lg.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{lg.tag} · {lg.members} members</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: 'var(--primary)', color: 'var(--primary-foreground)', flexShrink: 0 }}>Join</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Create Team page (mirrors CreateTeam.tsx) — a single centered card with a
// name field. Reached by every "Create team" action in the no-team flow.
function CreateTeamScreen({ onSubmit }) {
  return (
    <div style={{ minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', textAlign: 'center', color: 'var(--foreground)' }}>Create Your Team</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, textAlign: 'center', color: 'var(--muted-foreground)' }}>Choose a name for your fantasy F1 team</p>
        <div style={{ marginTop: 22 }}>
          <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>Team Name <span style={{ color: 'var(--delta-down, #f87171)' }}>*</span></label>
          <div style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', background: 'var(--background)', border: '1px solid var(--input)', borderRadius: 'calc(var(--radius) - 2px)', color: 'var(--muted-foreground)', fontSize: 13.5 }}>Enter your team name</div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>You can change this later</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 18 }}>
          <PrimaryButton onClick={onSubmit}>Create Team</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// The scrollable page body. hasTeam toggles between the two real Home states.
// desktop switches to the md: layout (row cards, 2-up scores, single-table leagues).
function HomeScreen({ hasTeam, desktop, onCreate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: desktop ? 24 : 16, padding: desktop ? '0' : '16px 16px 8px' }}>
      <header>
        {hasTeam ? (
          <>
            <p style={{ margin: 0, fontSize: desktop ? 14 : 12, color: 'var(--muted-foreground)' }}>Welcome back, Daniel</p>
            <h2 style={{ margin: '2px 0 0', fontSize: desktop ? 26 : 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>{F1_TEAM.name}</h2>
          </>
        ) : (
          <h2 style={{ margin: 0, fontSize: desktop ? 26 : 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>Welcome, Daniel</h2>
        )}
      </header>
      {!hasTeam && <CreateTeamHero desktop={desktop} onCreate={onCreate} />}
      <NextRaceCard desktop={desktop} />
      {hasTeam && (
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: desktop ? 12 : 8 }}>
          <ScoreCard eyebrow="Last race stats" title={F1_LASTRACE.name} score={F1_LASTRACE.score} />
          <ScoreCard eyebrow="Season stats" title="Total" score={F1_SEASON} />
        </div>
      )}
      {hasTeam ? <LeaguesList desktop={desktop} /> : <LeaguesNeedTeamNotice desktop={desktop} />}
    </div>
  );
}

Object.assign(window, {
  useNavDestinations, F1Avatar, AccountMenu, HomeScreen,
  BrowseScreen, PrimaryButton, CreateTeamScreen,
  F1_PROFILE, F1_TEAM, Eyebrow, Card,
});
