export function jouleToKwh(jouleEnergy: number, roundedUp = false) {
  const value = jouleEnergy / (3.6 * 10 ** 6);
  if (roundedUp) {
    return Math.ceil(value);
  }
  return value;
}

// Convert km/h to m/s
export function kmh2ms(kmh: number) {
  return Math.abs(kmh / 3.6);
}

// Convert m/s to km/h
export function ms2kmh(ms: number) {
  return ms * 3.6;
}

export function m2kmOneDecimal(m: number) {
  return Math.round(m / 100) / 10;
}
