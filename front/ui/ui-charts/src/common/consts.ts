export const PICKING_LAYERS = ['paths', 'overlay'] as const;
export const LAYERS = ['background', 'graduations', 'paths', 'overlay', 'captions'] as const;

// ========== DURATION CONSTANTS ==========

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

// ========== CONVERSION CONSTANTS ==========

export const MILLIMETERS_PER_KM = 1_000_000;
export const METERS_PER_KM = 1_000;

// ========== FONT CONSTANTS ==========

export const FONT_MONO = 'IBM Plex Mono';
export const FONT_SANS = 'IBM Plex Sans';

export const FONT_MONO_REGULAR = `400 10px ${FONT_MONO}`;
export const FONT_SANS_REGULAR = `400 12px ${FONT_SANS}`

export const FONT_MONO_BOLD = `600 12px ${FONT_MONO}`;
export const FONT_SANS_BOLD = `600 14px ${FONT_SANS}`;
