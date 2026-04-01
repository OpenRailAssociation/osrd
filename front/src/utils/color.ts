import chroma from 'chroma-js';

/**
 * Linear color interpolation for a value from the domain range into the scale range.
 *
 * @param scale The color of the range you want (target range)
 * @param domain The min & max of the domain range of the data (data range)
 * @param value The value in domain range to interpolate into scale range
 * @returns A color as string like rgb(0,0,0)
 */
export function linearColorScaleInterpolation(
  scale: { from: string; to: string },
  domain: { min: number; max: number },
  value: number
): string {
  // Checks
  if (domain.min > domain.max)
    throw new Error("Domain: 'min' is superior to 'max' which is not allowed");

  // Side effects
  if (value >= domain.max) return scale.to;
  if (value <= domain.min) return scale.from;

  // Linear interpolation
  const f = chroma.scale([scale.from, scale.to]).domain([domain.min, domain.max]);
  return f(value).hex();
}
