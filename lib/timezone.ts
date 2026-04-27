import zipcodesToTimezones from 'zipcode-to-timezone';

// Basic state to timezone mapping for fallback
const stateTimezoneMap: Record<string, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DE: 'America/New_York',
  FL: 'America/New_York', // Split state, default to Eastern
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  ME: 'America/New_York',
  MD: 'America/New_York',
  MA: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MS: 'America/Chicago',
  MO: 'America/Chicago',
  MT: 'America/Denver',
  NE: 'America/Chicago',
  NV: 'America/Los_Angeles',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NY: 'America/New_York',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago', // Split state, default to Central
  UT: 'America/Denver',
  VT: 'America/New_York',
  VA: 'America/New_York',
  WA: 'America/Los_Angeles',
  WV: 'America/New_York',
  WI: 'America/Chicago',
  WY: 'America/Denver',
};

// Simplified Area Code to Timezone mapping (covering major ones for fallback)
// A full map would be hundreds of entries.
const areaCodeMap: Record<string, string> = {
  // Eastern
  '201': 'America/New_York', '202': 'America/New_York', '203': 'America/New_York', '207': 'America/New_York',
  '212': 'America/New_York', '215': 'America/New_York', '216': 'America/New_York', '234': 'America/New_York',
  '240': 'America/New_York', '248': 'America/New_York', '267': 'America/New_York', '301': 'America/New_York',
  '302': 'America/New_York', '305': 'America/New_York', '313': 'America/New_York', '315': 'America/New_York',
  '321': 'America/New_York', '330': 'America/New_York', '347': 'America/New_York', '386': 'America/New_York',
  '401': 'America/New_York', '404': 'America/New_York', '407': 'America/New_York', '410': 'America/New_York',
  '412': 'America/New_York', '419': 'America/New_York', '440': 'America/New_York', '443': 'America/New_York',
  '484': 'America/New_York', '513': 'America/New_York', '516': 'America/New_York', '518': 'America/New_York',
  '561': 'America/New_York', '585': 'America/New_York', '609': 'America/New_York', '610': 'America/New_York',
  '614': 'America/New_York', '617': 'America/New_York', '631': 'America/New_York', '646': 'America/New_York',
  '703': 'America/New_York', '704': 'America/New_York', '716': 'America/New_York', '717': 'America/New_York',
  '718': 'America/New_York', '727': 'America/New_York', '732': 'America/New_York', '757': 'America/New_York',
  '770': 'America/New_York', '786': 'America/New_York', '804': 'America/New_York', '813': 'America/New_York',
  '814': 'America/New_York', '856': 'America/New_York', '860': 'America/New_York', '904': 'America/New_York',
  '908': 'America/New_York', '914': 'America/New_York', '917': 'America/New_York', '919': 'America/New_York',
  '954': 'America/New_York', '973': 'America/New_York', '980': 'America/New_York',
  // Central
  '205': 'America/Chicago', '214': 'America/Chicago', '217': 'America/Chicago', '224': 'America/Chicago',
  '225': 'America/Chicago', '228': 'America/Chicago', '251': 'America/Chicago', '254': 'America/Chicago',
  '256': 'America/Chicago', '262': 'America/Chicago', '281': 'America/Chicago', '308': 'America/Chicago',
  '309': 'America/Chicago', '312': 'America/Chicago', '314': 'America/Chicago', '316': 'America/Chicago',
  '318': 'America/Chicago', '319': 'America/Chicago', '325': 'America/Chicago', '334': 'America/Chicago',
  '337': 'America/Chicago', '361': 'America/Chicago', '402': 'America/Chicago', '405': 'America/Chicago',
  '409': 'America/Chicago', '414': 'America/Chicago', '417': 'America/Chicago', '430': 'America/Chicago',
  '432': 'America/Chicago', '469': 'America/Chicago', '479': 'America/Chicago', '501': 'America/Chicago',
  '504': 'America/Chicago', '507': 'America/Chicago', '512': 'America/Chicago', '515': 'America/Chicago',
  '534': 'America/Chicago', '539': 'America/Chicago', '563': 'America/Chicago', '573': 'America/Chicago',
  '601': 'America/Chicago', '605': 'America/Chicago', '608': 'America/Chicago', '615': 'America/Chicago',
  '618': 'America/Chicago', '630': 'America/Chicago', '636': 'America/Chicago', '641': 'America/Chicago',
  '660': 'America/Chicago', '662': 'America/Chicago', '682': 'America/Chicago', '701': 'America/Chicago',
  '708': 'America/Chicago', '712': 'America/Chicago', '713': 'America/Chicago', '715': 'America/Chicago',
  '731': 'America/Chicago', '734': 'America/Chicago', '763': 'America/Chicago', '769': 'America/Chicago',
  '773': 'America/Chicago', '785': 'America/Chicago', '815': 'America/Chicago', '816': 'America/Chicago',
  '817': 'America/Chicago', '830': 'America/Chicago', '832': 'America/Chicago', '847': 'America/Chicago',
  '870': 'America/Chicago', '901': 'America/Chicago', '903': 'America/Chicago', '913': 'America/Chicago',
  '915': 'America/Chicago', '918': 'America/Chicago', '920': 'America/Chicago', '931': 'America/Chicago',
  '936': 'America/Chicago', '940': 'America/Chicago', '956': 'America/Chicago', '972': 'America/Chicago',
  '979': 'America/Chicago',
  // Mountain
  '208': 'America/Denver', '303': 'America/Denver', '307': 'America/Denver', '385': 'America/Denver',
  '406': 'America/Denver', '435': 'America/Denver', '480': 'America/Phoenix', '505': 'America/Denver',
  '520': 'America/Phoenix', '575': 'America/Denver', '602': 'America/Phoenix', '623': 'America/Phoenix',
  '719': 'America/Denver', '720': 'America/Denver', '801': 'America/Denver', '928': 'America/Phoenix',
  '970': 'America/Denver',
  // Pacific
  '206': 'America/Los_Angeles', '209': 'America/Los_Angeles', '213': 'America/Los_Angeles', '253': 'America/Los_Angeles',
  '310': 'America/Los_Angeles', '323': 'America/Los_Angeles', '360': 'America/Los_Angeles', '408': 'America/Los_Angeles',
  '415': 'America/Los_Angeles', '425': 'America/Los_Angeles', '510': 'America/Los_Angeles', '530': 'America/Los_Angeles',
  '559': 'America/Los_Angeles', '562': 'America/Los_Angeles', '619': 'America/Los_Angeles', '626': 'America/Los_Angeles',
  '650': 'America/Los_Angeles', '661': 'America/Los_Angeles', '702': 'America/Los_Angeles', '714': 'America/Los_Angeles',
  '760': 'America/Los_Angeles', '775': 'America/Los_Angeles', '805': 'America/Los_Angeles', '818': 'America/Los_Angeles',
  '831': 'America/Los_Angeles', '858': 'America/Los_Angeles', '909': 'America/Los_Angeles', '916': 'America/Los_Angeles',
  '925': 'America/Los_Angeles', '949': 'America/Los_Angeles', '951': 'America/Los_Angeles',
};

/**
 * Infers a timezone (e.g. 'America/New_York') from a location string or phone number.
 */
export function inferTimezone(location: string, phone: string): string {
  // 1. Try to extract Zip Code from location string (highly accurate)
  const zipMatch = location.match(/\b\d{5}\b/);
  if (zipMatch && zipMatch[0]) {
    const tz = zipcodesToTimezones.lookup(zipMatch[0]);
    if (tz) return tz;
  }

  // 2. Try to extract US State abbreviation from location string
  const stateMatch = location.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i);
  if (stateMatch && stateMatch[0]) {
    const state = stateMatch[0].toUpperCase();
    if (stateTimezoneMap[state]) return stateTimezoneMap[state];
  }

  // 3. Fallback to Phone Number Area Code
  if (phone) {
    // Strip everything but digits
    const digits = phone.replace(/\D/g, "");
    // Extract 3-digit area code
    let areaCode = "";
    if (digits.length === 10) {
      areaCode = digits.substring(0, 3);
    } else if (digits.length === 11 && digits.startsWith("1")) {
      areaCode = digits.substring(1, 4);
    }
    
    if (areaCode && areaCodeMap[areaCode]) {
      return areaCodeMap[areaCode];
    }
  }

  // Fallback to Eastern Time if all else fails
  return "America/New_York";
}
