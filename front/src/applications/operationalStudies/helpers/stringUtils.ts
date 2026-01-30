export const splitTokens = (raw: string) =>
  raw
    .trim()
    .split(/[\s/-]+/)
    .filter(Boolean);

export const norm = (s: string) => s.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
export const normalizePhrase = (value: string) =>
  value
    .normalize('NFD')
    .toLowerCase()
    .split('-')
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .join(' ')
    .trim();
