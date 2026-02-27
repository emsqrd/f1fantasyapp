export interface TeamDriver {
  slotPosition: number;
  id: number;
  firstName: string;
  lastName: string;
  abbreviation: string;
  countryAbbreviation: string;
  price: number;
  isCaptain: boolean;
}

export interface TeamConstructor {
  slotPosition: number;
  id: number;
  name: string;
  fullName: string;
  abbreviation: string;
  countryAbbreviation: string;
  price: number;
}

export interface Team {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  remainingBudget: number;
  drivers: TeamDriver[];
  constructors: TeamConstructor[];
}
