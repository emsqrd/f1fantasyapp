import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';

// ---------------------------------------------
// Types
// ---------------------------------------------
export type LeaderboardRow = {
  id: string | number;
  teamName: string;
  ownerName: string;
  totalPoints: number;
  avgPoints: number;
  rank?: number; // optional if you want computed rank
  change?: number; // +/- places movement since last round
  isUserTeam?: boolean; // highlight current user's team
};

export type LeaderboardProps = {
  rows: LeaderboardRow[];
  initialSort?: keyof Pick<LeaderboardRow, 'totalPoints' | 'avgPoints' | 'teamName' | 'ownerName'>;
  initialDir?: 'asc' | 'desc';
  className?: string;
  showSearch?: boolean;
  showChange?: boolean;
};

// ---------------------------------------------
// Helper utils
// ---------------------------------------------
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const medalColors: Record<number, string> = {
  1: 'bg-yellow-400/20 text-yellow-900 dark:text-yellow-100 border-yellow-400/40',
  2: 'bg-zinc-300/20 text-zinc-900 dark:text-zinc-100 border-zinc-300/40',
  3: 'bg-amber-700/15 text-amber-900 dark:text-amber-100 border-amber-700/30',
};

// ---------------------------------------------
// Component
// ---------------------------------------------
export default function LeaderboardDemo({
  rows,
  initialSort = 'totalPoints',
  initialDir = 'desc',
  className,
  showSearch = true,
  showChange = true,
}: LeaderboardProps) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'totalPoints' | 'avgPoints' | 'teamName' | 'ownerName'>(
    initialSort,
  );
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.teamName, r.ownerName].some((s) => s.toLowerCase().includes(q)));
  }, [rows, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const mult = dir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return mult * (av - bv);
      return mult * String(av).localeCompare(String(bv));
    });
    // derive rank based on current sort when sorting by numeric points; otherwise preserve provided rank order
    if (sortBy === 'totalPoints' || sortBy === 'avgPoints') {
      copy.forEach((r, i) => (r.rank = i + 1));
    }
    return copy;
  }, [filtered, sortBy, dir]);

  const toggleDir = () => setDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          <h2 className="text-xl font-semibold tracking-tight">League Leaderboard</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2 h-4 w-4 opacity-60" />
              <Input
                placeholder="Search team or owner"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="totalPoints">Total points</SelectItem>
                <SelectItem value="avgPoints">Average points</SelectItem>
                <SelectItem value="teamName">Team name</SelectItem>
                <SelectItem value="ownerName">Owner name</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={toggleDir}
              className="hover:bg-accent inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm"
            >
              <ArrowUpDown className="h-4 w-4" /> {dir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-card hidden rounded-2xl border shadow-sm md:block">
        <Table>
          <TableHeader className="bg-card/95 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10 backdrop-blur">
            <TableRow>
              <TableHead className="w-14">Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="min-w-[180px]">Owner</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              {showChange && <TableHead className="text-right">Δ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}>
              {sorted.map((r, idx) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={cn(
                    'border-b',
                    idx % 2 === 0 ? 'bg-muted/30' : 'bg-transparent',
                    r.isUserTeam && 'bg-primary/5',
                  )}
                >
                  <TableCell className="font-mono text-sm">{r.rank ?? idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].includes(r.rank ?? idx + 1) ? (
                        <Badge
                          variant="outline"
                          className={cn('border', medalColors[(r.rank ?? idx + 1) as 1 | 2 | 3])}
                        >
                          {(r.rank ?? idx + 1) === 1
                            ? '🥇'
                            : (r.rank ?? idx + 1) === 2
                              ? '🥈'
                              : '🥉'}
                        </Badge>
                      ) : null}
                      <span>{r.teamName}</span>
                      {r.isUserTeam && (
                        <Badge variant="secondary" className="ml-1">
                          Your team
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.ownerName}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.totalPoints.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.avgPoints.toFixed(1)}
                  </TableCell>
                  {showChange && (
                    <TableCell className="text-right">
                      {typeof r.change === 'number' ? (
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-1 tabular-nums',
                            r.change > 0 && 'text-green-600',
                            r.change < 0 && 'text-red-600',
                          )}
                        >
                          {r.change > 0 && <ArrowUp className="h-3.5 w-3.5" />}
                          {r.change < 0 && <ArrowDown className="h-3.5 w-3.5" />}
                          {r.change === 0 ? '—' : Math.abs(r.change)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        <AnimatePresence initial={false}>
          {sorted.map((r, idx) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'bg-card rounded-2xl border p-3 shadow-sm',
                r.isUserTeam && 'ring-primary/40 ring-2',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground font-mono text-sm">
                    #{r.rank ?? idx + 1}
                  </div>
                  <div className="font-semibold">{r.teamName}</div>
                </div>
                {[1, 2, 3].includes(r.rank ?? idx + 1) && (
                  <Badge
                    variant="outline"
                    className={cn('border', medalColors[(r.rank ?? idx + 1) as 1 | 2 | 3])}
                  >
                    {(r.rank ?? idx + 1) === 1 ? '🥇' : (r.rank ?? idx + 1) === 2 ? '🥈' : '🥉'}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">Owner: {r.ownerName}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm">
                  <div className="tabular-nums">
                    <span className="text-muted-foreground">Total:</span>{' '}
                    <span className="font-semibold">{r.totalPoints.toLocaleString()}</span>
                  </div>
                  <div className="tabular-nums">
                    <span className="text-muted-foreground">Avg:</span> {r.avgPoints.toFixed(1)}
                  </div>
                </div>
                {showChange && (
                  <div className="text-right text-sm tabular-nums">
                    {typeof r.change === 'number' ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          r.change > 0 && 'text-green-600',
                          r.change < 0 && 'text-red-600',
                        )}
                      >
                        {r.change > 0 && <ArrowUp className="h-3.5 w-3.5" />}
                        {r.change < 0 && <ArrowDown className="h-3.5 w-3.5" />}
                        {r.change === 0 ? '—' : Math.abs(r.change)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </div>
                )}
              </div>
              {r.isUserTeam && (
                <Badge className="mt-2" variant="secondary">
                  Your team
                </Badge>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------
// Example usage (remove once wired to real data)
// ---------------------------------------------
export function DemoLeaderboard() {
  const sample: LeaderboardRow[] = [
    {
      id: 1,
      teamName: 'Box Box Heroes',
      ownerName: 'Mark Manthey',
      totalPoints: 512,
      avgPoints: 128.0,
      rank: 1,
      change: +1,
      isUserTeam: true,
    },
    {
      id: 2,
      teamName: 'Porpoising Pals',
      ownerName: 'Alex Smith',
      totalPoints: 498,
      avgPoints: 124.5,
      rank: 2,
      change: -1,
    },
    {
      id: 3,
      teamName: 'DRS Express',
      ownerName: 'Jamie Lee',
      totalPoints: 472,
      avgPoints: 118.0,
      rank: 3,
      change: 0,
    },
    {
      id: 4,
      teamName: 'Chicane Champs',
      ownerName: 'Priya K.',
      totalPoints: 441,
      avgPoints: 110.3,
      rank: 4,
      change: +2,
    },
    {
      id: 5,
      teamName: 'Late Brakers',
      ownerName: 'Diego M.',
      totalPoints: 430,
      avgPoints: 107.5,
      rank: 5,
      change: -1,
    },
  ];
  return (
    <div className="p-4">
      <LeaderboardDemo rows={sample} />
    </div>
  );
}
