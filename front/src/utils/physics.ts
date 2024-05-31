export function jouleToKwh(jouleEnergy: number, roundedUp = false) {
  const value = jouleEnergy / (3.6 * 10 ** 6);
  if (roundedUp) {
    return Math.ceil(value);
  }
  return value;
}

// Convert millimeters to meters
export function mmToM(length: number) {
  return length / 1000;
}

// Convert km/h to m/s
export function kmhToMs(v: number) {
  return Math.abs(v / 3.6);
}

// Convert m/s to km/h
export function msToKmh(v: number) {
  return v * 3.6;
}

export function mToKmOneDecimal(m: number) {
  return Math.round(m / 100) / 10;
}
