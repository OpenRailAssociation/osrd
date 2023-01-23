export default function budgetFormat(amount) {
  const amountFormatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumSignificantDigits: 2,
  }).format(amount);
  return amountFormatted;
}
