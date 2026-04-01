import chroma from 'chroma-js';

/**
 * Linear color interpolation for a value from the domain range into the scale range.
 *
 * @param scale The min & max color (of the range you want (the target range)
 * @param domain The min & max of the domain range of the data (the data range)
 * @param value The value in domain range to interpolate into scale range
 * @returns A color as string like rgb(0,0,0)
 */
export function linearColorScaleInterpolation(
  scale: { min: string; max: string },
  domain: { min: number; max: number },
  value: number
): string {
  // Checks
  if (domain.min > domain.max)
    throw new Error("Domain: 'min' is superior to 'max' which is not allowed");

  // Side effects
  if (value >= domain.max) return scale.max;
  if (value <= domain.min) return scale.min;

  // Linear interpolation
  const f = chroma.scale([scale.min, scale.max]).domain([domain.min, domain.max]);
  return f(value).hex();
}
