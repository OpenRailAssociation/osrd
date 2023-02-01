// eslint-disable-next-line import/prefer-default-export
export function jouleToKwh(jouleEnergy: number, roundedUp = false) {
  const value = jouleEnergy / (3.6 * 10 ** 6);
  if (roundedUp) {
    return Math.ceil(value);
  }
  return value;
}
