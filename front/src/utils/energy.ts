// eslint-disable-next-line import/prefer-default-export
export function jouleToKwh(jouleEnergy: number) {
  return Math.ceil(jouleEnergy / (3.6 * 10 ** 6));
}
