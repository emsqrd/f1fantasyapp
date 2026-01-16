export interface TeamDriver {
  slotPosition: number;
  id: number;
  firstName: string;
  lastName: string;
  abbreviation: string;
  countryAbbreviation: string;
}

export interface TeamConstructor {
  slotPosition: number;
  id: number;
  name: string;
  fullName: string;
  countryAbbreviation: string;
}

export interface Team {
  id: number;
  name: string;
  ownerName: string;
  drivers: TeamDriver[];
  constructors: TeamConstructor[];
}
