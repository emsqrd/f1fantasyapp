// Mock league + team data for the leaderboard prototype
const LEAGUE = {
  id: 'apex-2026',
  name: 'Apex Pit Wall',
  description: 'A friendly league for slow-burn strategy enjoyers. No trash talk, lots of trash talk.',
  season: '2026',
  totalRounds: 24,
  memberCount: 14,
  currentWeekend: {
    round: 7,
    name: 'Miami Grand Prix',
    short: 'Miami GP',
    weekendFormat: 1, // 0 = standard, 1 = sprint
    // Sessions in chronological order. Each has a lock deadline (when scoring
    // for that session is locked in) and a label for the leaderboard chip.
    // Set status: 'scored' | 'live' | 'upcoming'.
    sessions: [
      { key: 'sprint',  label: 'Sprint',       at: 'Sat 12:00 ET', status: 'scored'   },
      { key: 'quali',   label: 'Qualifying',   at: 'Sat 4:00 ET',  status: 'scored'   },
      { key: 'race',    label: 'Race',         at: 'Sun 4:00 ET',  status: 'upcoming' },
    ],
  },
};

// teams pre-sorted by totalPoints desc; positionChange = previous - current
// (positive = moved up the table, negative = moved down)
const TEAMS = [
  { id: 'mp4', name: 'Mango Lassi Racing', ownerName: 'Priya Iyer',     ownerHandle: 'priya',      avatarHue: 22,  totalPoints: 1284, roundPoints: 187, positionChange: 0,  isMyTeam: false },
  { id: 'gx7', name: 'Gravel Trap GP',     ownerName: 'Marcus Doyle',   ownerHandle: 'marcd',      avatarHue: 220, totalPoints: 1241, roundPoints: 162, positionChange: 1,  isMyTeam: false },
  { id: 'tk9', name: 'Tyre Wall Tactics',  ownerName: 'Soraya Ahmadi',  ownerHandle: 'sora',       avatarHue: 308, totalPoints: 1219, roundPoints: 134, positionChange: -1, isMyTeam: false },
  { id: 'me1', name: 'Box Box Bandits',    ownerName: 'Alex Morgan',    ownerHandle: 'you',        avatarHue: 156, totalPoints: 1188, roundPoints: 201, positionChange: 3,  isMyTeam: true  },
  { id: 'rl4', name: 'Redline Romantics',  ownerName: 'Hannah Becker',  ownerHandle: 'hbecker',    avatarHue: 354, totalPoints: 1162, roundPoints: 121, positionChange: -1, isMyTeam: false },
  { id: 'kk2', name: 'Kerb Kissers',       ownerName: 'Jonas Lindqvist', ownerHandle: 'jonas',     avatarHue: 188, totalPoints: 1140, roundPoints: 142, positionChange: 0,  isMyTeam: false },
  { id: 'sl8', name: 'Slipstream Society', ownerName: 'Ade Okonkwo',    ownerHandle: 'ade',        avatarHue: 44,  totalPoints: 1118, roundPoints: 98,  positionChange: -2, isMyTeam: false },
  { id: 'pm5', name: 'Parc Fermé Pirates', ownerName: 'Camila Vega',    ownerHandle: 'camv',       avatarHue: 268, totalPoints: 1094, roundPoints: 156, positionChange: 2,  isMyTeam: false },
  { id: 'dr3', name: 'DRS Disciples',      ownerName: 'Theo Laurent',   ownerHandle: 'theo',       avatarHue: 112, totalPoints: 1071, roundPoints: 110, positionChange: -1, isMyTeam: false },
  { id: 'fl0', name: 'Formation Lap Llamas', ownerName: 'Reggie Park',  ownerHandle: 'rpark',      avatarHue: 18,  totalPoints: 1058, roundPoints: 145, positionChange: 1,  isMyTeam: false },
  { id: 'ch6', name: 'Chicane Cartel',     ownerName: 'Yuki Tanabe',    ownerHandle: 'yuki',       avatarHue: 332, totalPoints: 1024, roundPoints: 132, positionChange: 0,  isMyTeam: false },
  { id: 'pp7', name: 'Pole Position Pals', ownerName: 'Daniela Ruiz',   ownerHandle: 'dani',       avatarHue: 248, totalPoints: 998,  roundPoints: 88,  positionChange: -2, isMyTeam: false },
  { id: 'sf2', name: 'Safety Car Society', ownerName: 'Owen Mbeki',     ownerHandle: 'owen',       avatarHue: 80,  totalPoints: 962,  roundPoints: 119, positionChange: 1,  isMyTeam: false },
  { id: 'wt1', name: 'Wet Tyre Wizards',   ownerName: 'Lina Forsberg',  ownerHandle: 'lina',       avatarHue: 200, totalPoints: 901,  roundPoints: 76,  positionChange: -1, isMyTeam: false },
];

window.LEAGUE = LEAGUE;
window.TEAMS = TEAMS;
