export function getRegionForCountry(countryCode: string): string {
  const regionMap: Record<string, string> = {
    // South Asia
    IN: 'south-asia', PK: 'south-asia', BD: 'south-asia', LK: 'south-asia', NP: 'south-asia',
    // East Asia
    CN: 'east-asia', JP: 'east-asia', KR: 'east-asia', TW: 'east-asia',
    // Southeast Asia
    SG: 'southeast-asia', MY: 'southeast-asia', ID: 'southeast-asia', TH: 'southeast-asia', PH: 'southeast-asia', VN: 'southeast-asia',
    // Europe
    GB: 'europe', DE: 'europe', FR: 'europe', IT: 'europe', ES: 'europe', NL: 'europe', BE: 'europe', PL: 'europe', SE: 'europe', NO: 'europe', DK: 'europe', FI: 'europe', AT: 'europe', CH: 'europe', IE: 'europe', PT: 'europe', CZ: 'europe', RO: 'europe', HU: 'europe', UA: 'europe', GR: 'europe',
    // North America
    US: 'north-america', CA: 'north-america', MX: 'north-america',
    // South America
    BR: 'south-america', AR: 'south-america', CO: 'south-america', CL: 'south-america', PE: 'south-america',
    // Middle East
    SA: 'middle-east', AE: 'middle-east', IL: 'middle-east', TR: 'middle-east', IR: 'middle-east', IQ: 'middle-east',
    // Africa
    ZA: 'africa', NG: 'africa', EG: 'africa', KE: 'africa', ET: 'africa', GH: 'africa',
    // Oceania
    AU: 'oceania', NZ: 'oceania',
    // Central Asia
    RU: 'central-asia', KZ: 'central-asia', UZ: 'central-asia',
  };
  return regionMap[countryCode] || 'global';
}

export const REGION_LABELS: Record<string, string> = {
  'south-asia': 'South Asia',
  'east-asia': 'East Asia',
  'southeast-asia': 'Southeast Asia',
  'europe': 'Europe',
  'north-america': 'North America',
  'south-america': 'South America',
  'middle-east': 'Middle East',
  'africa': 'Africa',
  'oceania': 'Oceania',
  'central-asia': 'Central Asia',
  'global': 'Global',
};

export const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', JP: 'Japan', CN: 'China', BR: 'Brazil', MX: 'Mexico',
  KR: 'South Korea', SG: 'Singapore', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', CH: 'Switzerland', AT: 'Austria', IE: 'Ireland',
  NZ: 'New Zealand', ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', PK: 'Pakistan',
  BD: 'Bangladesh', LK: 'Sri Lanka', NP: 'Nepal', ID: 'Indonesia', TH: 'Thailand',
  PH: 'Philippines', VN: 'Vietnam', MY: 'Malaysia', IT: 'Italy', ES: 'Spain',
  PL: 'Poland', CZ: 'Czech Republic', RO: 'Romania', HU: 'Hungary', UA: 'Ukraine',
  GR: 'Greece', PT: 'Portugal', BE: 'Belgium', TR: 'Turkey', SA: 'Saudi Arabia',
  AE: 'UAE', IL: 'Israel', EG: 'Egypt', AR: 'Argentina', CO: 'Colombia', CL: 'Chile',
  PE: 'Peru', TW: 'Taiwan', RU: 'Russia', KZ: 'Kazakhstan', IR: 'Iran', IQ: 'Iraq',
  GH: 'Ghana', ET: 'Ethiopia', UZ: 'Uzbekistan',
};
