export const constructorColors: Record<string, string> = {
  RBR: '#3671C6',
  FER: '#E8002D',
  MCL: '#FF8000',
  MER: '#27F4D2',
  AMR: '#229971',
  ALP: '#FF87BC',
  WIL: '#64C4FF',
  RBS: '#6692FF',
  HAA: '#B6BABD',
  AUD: '#F50537',
  CAD: '#909090',
};

// Driver abbreviation → constructor abbreviation (2026 season)
export const driverConstructorMap: Record<string, string> = {
  VER: 'RBR',
  HAD: 'RBR',
  RUS: 'MER',
  ANT: 'MER',
  LEC: 'FER',
  HAM: 'FER',
  NOR: 'MCL',
  PIA: 'MCL',
  ALO: 'AMR',
  STR: 'AMR',
  GAS: 'ALP',
  COL: 'ALP',
  ALB: 'WIL',
  SAI: 'WIL',
  LAW: 'RBS',
  LIN: 'RBS',
  HUL: 'AUD',
  BOR: 'AUD',
  OCO: 'HAA',
  BEA: 'HAA',
  BOT: 'CAD',
  PER: 'CAD',
};

export function getConstructorColor(abbr: string): string | undefined {
  return constructorColors[abbr];
}

export function getDriverColor(abbr: string): string | undefined {
  const constructorAbbr = driverConstructorMap[abbr];
  return constructorAbbr ? constructorColors[constructorAbbr] : undefined;
}
