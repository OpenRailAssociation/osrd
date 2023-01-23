import dayjs from 'dayjs';

export function budgetFormat(amount) {
  const amountFormatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumSignificantDigits: 2,
  }).format(amount);
  return amountFormatted;
}

export function dateTimeFrenchFormatting(date) {
  return dayjs(date).format('D MMM YYYY HH:mm').replace(/\./gi, '');
}
