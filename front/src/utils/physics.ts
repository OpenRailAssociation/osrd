export function jouleToKwh(jouleEnergy: number, roundedUp = false) {
  const value = jouleEnergy / (3.6 * 10 ** 6);
  if (roundedUp) {
    return Math.ceil(value);
  }
  return value;
}

/** Convert meters to km */
export function mToKm(length: number) {
  return length / 1000;
}

/** Convert km to meters */
export function kmToM(length: number) {
  return length * 1000;
}

/** Convert millimeters to meters */
export function mmToM(length: number) {
  return length / 1000;
}

/** Convert meters to millimeters */
export function mToMm(length: number) {
  return length * 1000;
}

/** Convert millimeters to kilometers */
export function mmToKm(length: number) {
  return length / 1000000;
}

/** converts any unit to milli
 *  for example seconds to milliseconds
 */
export function sToMs(value: number) {
  return value * 1000;
}

/** converts any unit to base
 *  for example milliseconds to seconds
 */
export function msToS(value: number) {
  return value * 0.001;
}

/** Convert km/h to m/s */
export function kmhToMs(v: number) {
  return Math.abs(v / 3.6);
}

/** Convert m/s to km/h */
export function msToKmh(v: number) {
  return v * 3.6;
}

/** Convert m/s to km/h and round the result */
export function msToKmhRounded(v: number) {
  return Math.round(msToKmh(v));
}

/**
 * @return the margin in min/100km
 * @param timeLost in seconds
 * @param distance in meters
 */
export function minutePer100km(timeLost: number, distance: number) {
  return (100 * 1000 * timeLost) / (distance * 60) || 0;
}

/**
 * @return the time lost in seconds
 * @param margin in min/100km
 * @param distance in meters
 */
export function timeLostFromMin100KmMargin(margin: number, distance: number) {
  return (60 * margin * distance) / (100 * 1000);
}

/**
 * ex: converts 25 to 0.25
 * @param value in percentage
 */
export function percentageToDecimal(value: number) {
  return value * 0.01;
}

/**
 * ex: converts 0.25 to 25
 * @param value in decimal
 */
export function decimalToPercentage(value: number) {
  return value * 100;
}

/**
 * ex: converts 12t to 12000
 * @param value in ton
 */
export function tToKg(value: number) {
  return value * 1000;
}
