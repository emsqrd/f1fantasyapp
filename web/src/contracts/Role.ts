export interface BaseRole {
  id: number;
  countryAbbreviation: string;
}
export interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  countryAbbreviation: string;
}

export interface Constructor {
  id: number;
  name: string;
  fullName: string;
  countryAbbreviation: string;
}
