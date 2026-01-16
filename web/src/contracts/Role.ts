export interface BaseRole {
  type: 'driver' | 'constructor';
  id: number;
  countryAbbreviation: string;
}

export interface Driver extends BaseRole {
  type: 'driver';
  firstName: string;
  lastName: string;
}

export interface Constructor extends BaseRole {
  type: 'constructor';
  name: string;
  fullName: string;
}
