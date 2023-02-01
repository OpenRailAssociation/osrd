export function boundedValue(value: number, [min, max]: [number, number]) {
  if (value >= max) {
    return max;
  }
  if (value <= min) {
    return min;
  }
  return value;
}

export function budgetFormat(amount: number | bigint) {
  const amountFormatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumSignificantDigits: 2,
  }).format(amount);
  return amountFormatted;
}
