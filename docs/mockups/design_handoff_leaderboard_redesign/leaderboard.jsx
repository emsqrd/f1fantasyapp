// Leaderboard prototype — three layout variants gated by Tweaks
// Variants:
//   "table"   — dense data-table (closest to existing shadcn Table style)
//   "card"    — generous row cards (more visual hierarchy, mobile-friendly)
//   "podium"  — top-3 podium hero + table below (celebratory, good for league hubs)

const { useState, useMemo, useEffect } = React;

// Returns true when viewport width < bp. SSR-safe-ish.
function useIsNarrow(bp = 640) {
  const get = () => (typeof window !== 'undefined' ? window.innerWidth < bp : false);
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    const onResize = () => setNarrow(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}

// ---------- helpers ----------
// `glyphStyle` controls the up/down indicator appearance:
//   'triangle' — ▲/▼ filled triangles (default, classic)
//   'caret'    — ˄/˅ small caret marks (subtler)
//   'arrow'    — ↑/↓ single-line arrows (most legible at small sizes)
//   'chevron'  — ›-style chevrons rotated up/down
//   'plusminus'— +N / -N, no glyph (numbers do all the work)
function PositionDelta({ value, variant = 'pill', glyphStyle = 'triangle' }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const isFlat = value === 0;

  const styles = isUp
    ? { fg: 'var(--delta-up-fg)', bg: 'var(--delta-up-bg)' }
    : isDown
    ? { fg: 'var(--delta-down-fg)', bg: 'var(--delta-down-bg)' }
    : { fg: 'var(--delta-flat-fg)', bg: 'var(--delta-flat-bg)' };

  // Glyph table per style. Each entry: [up, down, fontSizeClass]
  const glyphTable = {
    triangle:  ['\u25b2', '\u25bc', 'text-[9px]'],
    caret:     ['\u02c4', '\u02c5', 'text-[14px]'],
    arrow:     ['\u2191', '\u2193', 'text-[12px]'],
    chevron:   ['\u2303', '\u2304', 'text-[12px]'],
    plusminus: ['', '', ''],
  };
  const [upGlyph, downGlyph, glyphSize] = glyphTable[glyphStyle] || glyphTable.triangle;
  const arrow = isUp ? upGlyph : isDown ? downGlyph : '';

  const numberLabel = isFlat
    ? '\u2013'
    : glyphStyle === 'plusminus'
      ? `${isUp ? '+' : '\u2212'}${Math.abs(value)}`
      : Math.abs(value);

  if (variant === 'inline') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums"
        style={{ color: styles.fg }}
        aria-label={
          isFlat ? 'No position change' : isUp ? `Up ${Math.abs(value)} positions` : `Down ${Math.abs(value)} positions`
        }
      >
        {arrow && <span aria-hidden="true" className={`${glyphSize} leading-none`}>{arrow}</span>}
        {numberLabel}
      </span>
    );
  }

  // Flat: just a muted dash, no pill background
  if (isFlat) {
    return (
      <span
        className="inline-flex items-center justify-center text-[14px] font-medium tabular-nums"
        style={{ color: 'var(--muted-foreground)' }}
        aria-label="No position change"
      >
        –
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums"
      style={{ color: styles.fg }}
      aria-label={isUp ? `Up ${Math.abs(value)} positions` : `Down ${Math.abs(value)} positions`}
    >
      {arrow && <span aria-hidden="true" className={`${glyphSize} leading-none`}>{arrow}</span>}
      {numberLabel}
    </span>
  );
}

function MonogramAvatar({ name, hue, size = 36 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: `oklch(0.62 0.14 ${hue})`,
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function RankBadge({ rank, large = false }) {
  const top = rank <= 3;
  const tints = {
    1: { bg: 'var(--medal-1-bg)', fg: 'var(--medal-1-fg)', ring: 'var(--medal-1-ring)' },
    2: { bg: 'var(--medal-2-bg)', fg: 'var(--medal-2-fg)', ring: 'var(--medal-2-ring)' },
    3: { bg: 'var(--medal-3-bg)', fg: 'var(--medal-3-fg)', ring: 'var(--medal-3-ring)' },
  };
  const t = top ? tints[rank] : { bg: 'var(--rank-bg)', fg: 'var(--rank-fg)', ring: 'var(--rank-ring)' };
  const sz = large ? 48 : 36;
  return (
    <div
      className="flex items-center justify-center rounded-full font-mono font-bold tabular-nums"
      style={{
        width: sz,
        height: sz,
        fontSize: large ? 20 : 15,
        backgroundColor: t.bg,
        color: t.fg,
        boxShadow: `inset 0 0 0 1px ${t.ring}`,
      }}
      aria-hidden="true"
    >
      {rank}
    </div>
  );
}

function ChevronRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Minimal typographic rank — used in the table where the bigger circle felt heavy.
function RankNumber({ rank }) {
  return (
    <div className="flex items-center justify-center" aria-hidden="true">
      <span
        className="font-mono font-semibold tabular-nums"
        style={{
          fontSize: 16,
          color: rank <= 3 ? 'var(--foreground)' : 'var(--muted-foreground)',
          minWidth: 22,
          textAlign: 'center',
        }}
      >
        {rank}
      </span>
    </div>
  );
}

// ---------- variant: data table ----------
// myRowStyle controls how the user's own row is highlighted:
//   'tint'   - subtle full-row background tint only
//   'border' - 3px primary-colored leading border on the row (passes WCAG 1.4.11)
//   'both'   - tint + border (strongest signal)
function TableVariant({ teams, onOpenTeam, density, myRowStyle = 'border', glyphStyle = 'triangle' }) {
  const padY = density === 'compact' ? 'py-2' : density === 'roomy' ? 'py-4' : 'py-3';
  return (
    <div className="overflow-hidden rounded-[0.65rem] border border-[var(--border)] bg-[var(--card)]">
      <div role="table" aria-label="League leaderboard" className="w-full">
        <div
          role="row"
          className="grid items-center gap-3 border-b border-[var(--border)] bg-[var(--secondary)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
          style={{ gridTemplateColumns: '52px 1fr 70px 96px 36px' }}
        >
          <div role="columnheader" className="text-center">Pos</div>
          <div role="columnheader">Team</div>
          <div role="columnheader" className="text-center">Move</div>
          <div role="columnheader" className="text-right">Total</div>
          <div role="columnheader" aria-label="Open team" />
        </div>
        {teams.map((t, idx) => {
          const rank = idx + 1;
          const meTint = t.isMyTeam && (myRowStyle === 'tint' || myRowStyle === 'both');
          const meBorder = t.isMyTeam && (myRowStyle === 'border' || myRowStyle === 'both');
          return (
            <button
              key={t.id}
              role="row"
              onClick={() => onOpenTeam(t)}
              className={`grid w-full items-center gap-3 border-b border-[var(--border)] px-4 ${padY} text-left transition-colors last:border-b-0 hover:bg-[var(--accent)] focus:bg-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                meTint ? 'bg-[color-mix(in_oklab,var(--row-highlight)_var(--row-highlight-strength),transparent)]' : ''
              }`}
              style={{
                gridTemplateColumns: '52px 1fr 70px 96px 36px',
                boxShadow: meBorder ? 'inset 0 0 0 1.5px var(--row-highlight-border)' : undefined,
              }}
              aria-label={`Open ${t.name}, position ${rank}`}
            >
              <div role="cell" className="flex justify-center">
                <RankNumber rank={rank} />
              </div>
              <div role="cell" className="flex min-w-0 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-[var(--foreground)]">{t.name}</span>
                  </div>
                  <div className="truncate text-[12px] text-[var(--muted-foreground)]">{t.ownerName}</div>
                </div>
              </div>
              <div role="cell" className="flex justify-center">
                <PositionDelta value={t.positionChange} glyphStyle={glyphStyle} />
              </div>
              <div role="cell" className="text-right">
                <div className="font-mono text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                  {t.totalPoints.toLocaleString()}
                </div>
              </div>
              <div role="cell" className="flex justify-center text-[var(--muted-foreground)]">
                <ChevronRight />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- variant: row cards ----------
function CardVariant({ teams, onOpenTeam, myRowStyle = 'border', glyphStyle = 'triangle' }) {
  return (
    <div className="flex flex-col gap-2">
      {teams.map((t, idx) => {
        const rank = idx + 1;
        const meTint = t.isMyTeam && (myRowStyle === 'tint' || myRowStyle === 'both');
        const meBorder = t.isMyTeam && (myRowStyle === 'border' || myRowStyle === 'both');
        return (
          <button
            key={t.id}
            onClick={() => onOpenTeam(t)}
            className={`group flex w-full items-center gap-3 rounded-[0.65rem] border p-3 text-left transition-all hover:-translate-y-px hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:gap-4 ${
              meBorder ? 'border-[var(--row-highlight-border)]' : 'border-[var(--border)] hover:border-[var(--ring)]'
            } ${meTint ? 'bg-[color-mix(in_oklab,var(--row-highlight)_var(--row-highlight-strength),var(--card))]' : 'bg-[var(--card)]'}`}
            aria-label={`Open ${t.name}, position ${rank}`}
          >
            <span
              className="font-mono text-[20px] font-bold tabular-nums w-8 shrink-0 text-center"
              style={{ color: rank <= 3 ? 'var(--foreground)' : 'var(--muted-foreground)' }}
              aria-hidden="true"
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-semibold text-[var(--foreground)]">{t.name}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--muted-foreground)]">
                <span className="truncate">{t.ownerName}</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <PositionDelta value={t.positionChange} variant="inline" glyphStyle={glyphStyle} />
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[18px] font-bold tabular-nums leading-none text-[var(--foreground)]">
                {t.totalPoints.toLocaleString()}
              </div>
            </div>
            <div className="hidden text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 sm:block">
              <ChevronRight size={18} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------- variant: podium + table ----------
function PodiumVariant({ teams, onOpenTeam, glyphStyle = 'triangle' }) {
  const podium = teams.slice(0, 3);
  // visual order: 2nd, 1st, 3rd
  const visualOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const heights = { 1: 132, 2: 104, 3: 88 };

  return (
    <div className="flex flex-col gap-6">
      {/* podium */}
      <div className="rounded-[0.65rem] border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Top 3 — After {LEAGUE.currentWeekend.short}
        </div>
        <div className="grid grid-cols-3 items-end gap-3">
          {visualOrder.map((t) => {
            if (!t) return <div key="empty" />;
            const rank = teams.indexOf(t) + 1;
            return (
              <button
                key={t.id}
                onClick={() => onOpenTeam(t)}
                className="group flex flex-col items-center gap-2 rounded-md p-2 transition-colors hover:bg-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={`Open ${t.name}, position ${rank}`}
              >
                <div className="text-center">
                  <div className="truncate text-[13px] font-semibold text-[var(--foreground)]">{t.name}</div>
                  <div className="truncate text-[11px] text-[var(--muted-foreground)]">{t.ownerName}</div>
                </div>
                <div
                  className="flex w-full flex-col items-center justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]"
                  style={{ height: heights[rank] }}
                >
                >
                  <div className="font-mono text-[28px] font-bold leading-none">{rank}</div>
                  <div className="mt-1 font-mono text-[14px] font-semibold tabular-nums">
                    {t.totalPoints.toLocaleString()}
                  </div>
                  <div className="mt-1">
                    <PositionDelta value={t.positionChange} glyphStyle={glyphStyle} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* full table below (uses TableVariant for consistency) */}
      <div>
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Full standings
        </div>
        <TableVariant teams={teams} onOpenTeam={onOpenTeam} density="comfortable" />
      </div>
    </div>
  );
}

// ---------- meta header ----------
function LeaderboardHeader({ mobile = false }) {
  const w = LEAGUE.currentWeekend;
  const nextSession = w.sessions.find((s) => s.status !== 'scored');
  const lastScored = [...w.sessions].reverse().find((s) => s.status === 'scored');

  return (
    <div className="pb-5">
      <h1 className={`font-bold tracking-tight text-[var(--foreground)] ${mobile ? 'text-[22px]' : 'text-[24px] sm:text-[28px]'}`}>
        {LEAGUE.name}
      </h1>
      {LEAGUE.description && (
        <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          {LEAGUE.description}
        </p>
      )}
      <div
        className={`mt-3 flex items-center gap-1.5 text-[12px] ${
          mobile
            ? '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'flex-wrap'
        }`}
      >
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 font-medium tabular-nums text-[var(--secondary-foreground)]">
          Round {w.round} <span className="text-[var(--muted-foreground)]">/ {LEAGUE.totalRounds}</span>
        </span>
        {lastScored && (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 font-medium text-[var(--secondary-foreground)]">
            <span className="text-[var(--muted-foreground)]">After</span>
            {w.short} {lastScored.label}
          </span>
        )}
        {nextSession && (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--primary)]/30 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-2.5 py-1 font-medium text-[var(--foreground)]">
            <span
              className="inline-block size-1.5 rounded-full bg-[var(--primary)]"
              aria-hidden="true"
            />
            <span className="text-[var(--muted-foreground)]">Next</span>
            {w.short} {nextSession.label}
            <span className="text-[var(--muted-foreground)]">· {nextSession.at}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- mock team page ----------
function TeamPage({ team, rank, onBack }) {
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <span aria-hidden="true">←</span> Back to leaderboard
      </button>
      <div className="rounded-[0.65rem] border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-bold text-[var(--foreground)]">{team.name}</h2>
            </div>
            <div className="text-[13px] text-[var(--muted-foreground)]">Owned by {team.ownerName}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { label: 'Position', value: `P${rank}` },
            { label: 'Total points', value: team.totalPoints.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="rounded-md border border-[var(--border)] bg-[var(--secondary)] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {s.label}
              </div>
              <div className="mt-1 font-mono text-[22px] font-bold tabular-nums text-[var(--foreground)]">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-md border border-dashed border-[var(--border)] p-8 text-center text-[13px] text-[var(--muted-foreground)]">
          (Team page is out of scope for this redesign — this is where the existing Team route would render: drivers, constructors, lineup history, etc.)
        </div>
      </div>
    </div>
  );
}

// ---------- root ----------
function LeaderboardApp() {
  const [tweaks, setTweak] = useTweaks(window.LEADERBOARD_DEFAULTS);
  const [openTeamId, setOpenTeamId] = useState(null);
  const isNarrow = useIsNarrow(640);

  const teams = useMemo(() => window.TEAMS, []);
  const openTeam = openTeamId ? teams.find((t) => t.id === openTeamId) : null;
  const openTeamRank = openTeam ? teams.indexOf(openTeam) + 1 : null;

  // Apply dark mode at the document level so :root tokens flip.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!tweaks.dark);
  }, [tweaks.dark]);

  // Push tint strength into a CSS var so the row-tint color-mix can read it.
  // The mix-toward color (--row-highlight) is itself defined per theme: foreground in
  // light mode (mixing toward dark gives contrast quickly), primary in dark mode
  // (the brand blue lifts off near-black readably).
  // Around 25% mix gets close to WCAG 1.4.11's 3:1 threshold in both modes.
  useEffect(() => {
    document.documentElement.style.setProperty('--row-highlight-strength', `${tweaks.tintStrength}%`);
  }, [tweaks.tintStrength]);

  const isMobilePreview = tweaks.preview === 'mobile';
  // In mobile preview, force card layout (matches narrow auto-swap behavior).
  // Otherwise honor the narrow viewport check.
  const effectiveLayout = isMobilePreview || isNarrow ? 'card' : tweaks.layout;

  const leaderboardContent = (
    <div className={`min-h-full bg-[var(--background)] ${isMobilePreview ? 'px-4 py-5 pt-14' : 'px-4 py-6 sm:px-6 sm:py-8 md:px-10'}`}>
      <div className={`mx-auto w-full ${isMobilePreview ? '' : 'max-w-[860px]'}`}>
        {openTeam ? (
          <TeamPage team={openTeam} rank={openTeamRank} onBack={() => setOpenTeamId(null)} />
        ) : (
          <>
            <LeaderboardHeader mobile={isMobilePreview} />
            {effectiveLayout === 'table' && (
              <TableVariant teams={teams} onOpenTeam={(t) => setOpenTeamId(t.id)} density={tweaks.density} myRowStyle={tweaks.myRowStyle} glyphStyle={tweaks.glyphStyle} />
            )}
            {effectiveLayout === 'card' && (
              <CardVariant teams={teams} onOpenTeam={(t) => setOpenTeamId(t.id)} myRowStyle={tweaks.myRowStyle} glyphStyle={tweaks.glyphStyle} />
            )}
            {effectiveLayout === 'podium' && (
              <PodiumVariant teams={teams} onOpenTeam={(t) => setOpenTeamId(t.id)} glyphStyle={tweaks.glyphStyle} />
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isMobilePreview ? (
        <div className="flex min-h-screen items-center justify-center bg-[color-mix(in_oklab,var(--foreground)_6%,var(--background))] p-8">
          <IOSDevice width={402} height={874} dark={!!tweaks.dark}>
            {leaderboardContent}
          </IOSDevice>
        </div>
      ) : (
        leaderboardContent
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Preview">
          <TweakRadio
            label="Viewport"
            value={tweaks.preview}
            options={[
              { value: 'desktop', label: 'Desktop' },
              { value: 'mobile', label: 'iPhone' },
            ]}
            onChange={(v) => setTweak('preview', v)}
          />
          <TweakToggle
            label="Dark mode"
            value={!!tweaks.dark}
            onChange={(v) => setTweak('dark', v)}
          />
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio
            label="Style"
            value={tweaks.layout}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'card', label: 'Cards' },
              { value: 'podium', label: 'Podium' },
            ]}
            onChange={(v) => setTweak('layout', v)}
          />
          {tweaks.layout === 'table' && !isMobilePreview && (
            <TweakRadio
              label="Density"
              value={tweaks.density}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Default' },
                { value: 'roomy', label: 'Roomy' },
              ]}
              onChange={(v) => setTweak('density', v)}
            />
          )}
          {tweaks.layout !== 'podium' && (
            <TweakRadio
              label="Your row"
              value={tweaks.myRowStyle}
              options={[
                { value: 'tint', label: 'Tint' },
                { value: 'border', label: 'Border' },
                { value: 'both', label: 'Both' },
              ]}
              onChange={(v) => setTweak('myRowStyle', v)}
            />
          )}
          {tweaks.layout !== 'podium' && (tweaks.myRowStyle === 'tint' || tweaks.myRowStyle === 'both') && (
            <TweakSlider
              label="Tint strength"
              value={tweaks.tintStrength}
              min={5}
              max={50}
              step={1}
              suffix="%"
              onChange={(v) => setTweak('tintStrength', v)}
            />
          )}
          <TweakSelect
            label="Move indicator"
            value={tweaks.glyphStyle}
            options={[
              { value: 'triangle',  label: '▲ ▼  Triangle' },
              { value: 'caret',     label: '˄ ˅  Caret' },
              { value: 'arrow',     label: '↑ ↓  Arrow' },
              { value: 'chevron',   label: '⌃ ⌄  Chevron' },
              { value: 'plusminus', label: '+N / −N  No glyph' },
            ]}
            onChange={(v) => setTweak('glyphStyle', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<LeaderboardApp />);
