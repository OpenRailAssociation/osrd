import { floor } from 'lodash';
import { describe, it, expect } from 'vitest';

import convertUnits from '../convertUnits';

describe('convertUnits', () => {
  it('should convert kg to t', () => {
    const convertedUnit = convertUnits('kg', 't', 1000);
    expect(convertedUnit).toEqual(1);
  });
  it('should convert t to kg', () => {
    const convertedUnit = convertUnits('t', 'kg', 15);
    expect(convertedUnit).toEqual(15000);
  });
  it('should convert km/h to m/s', () => {
    const convertedUnit = convertUnits('km/h', 'm/s', 150);
    expect(floor(convertedUnit, 1)).toEqual(41.6);
  });
  it('should convert m/s to km/h', () => {
    const convertedUnit = convertUnits('m/s', 'km/h', 50);
    expect(convertedUnit).toEqual(180);
  });
  it('should convert N to kN', () => {
    const convertedUnit = convertUnits('N', 'kN', 10000);
    expect(convertedUnit).toEqual(10);
  });
  it('should convert kN to N', () => {
    const convertedUnit = convertUnits('kN', 'N', 10);
    expect(convertedUnit).toEqual(10000);
  });
  it('should convert N/(m/s) to N/(km/h)', () => {
    const convertedUnit = convertUnits('N/(m/s)', 'N/(km/h)', 36);
    expect(convertedUnit).toEqual(10);
  });
  it('should convert N/(m/s) to kN/(km/h)', () => {
    const convertedUnit = convertUnits('N/(m/s)', 'kN/(km/h)', 36);
    expect(convertedUnit).toEqual(0.01);
  });
  it('should convert N/(km/h) to N/(m/s)', () => {
    const convertedUnit = convertUnits('N/(km/h)', 'N/(m/s)', 150);
    expect(convertedUnit).toEqual(540);
  });
  it('should convert N/(km/h) to kN/(km/h)', () => {
    const convertedUnit = convertUnits('N/(km/h)', 'kN/(km/h)', 150);
    expect(convertedUnit).toEqual(0.15);
  });
  it('should convert kN/(km/h) to N/(m/s)', () => {
    const convertedUnit = convertUnits('kN/(km/h)', 'N/(m/s)', 15);
    expect(convertedUnit).toEqual(54000);
  });
  it('should convert kN/(km/h) to N/(km/h)', () => {
    const convertedUnit = convertUnits('kN/(km/h)', 'N/(km/h)', 15);
    expect(convertedUnit).toEqual(15000);
  });
  it('should convert N/(m/s)² to N/(km/h)²', () => {
    const convertedUnit = convertUnits('N/(m/s)²', 'N/(km/h)²', 55);
    expect(floor(convertedUnit, 1)).toEqual(4.2);
  });
  it('should convert N/(m/s)² to kN/(km/h)²', () => {
    const convertedUnit = convertUnits('N/(m/s)²', 'kN/(km/h)²', 55);
    expect(floor(convertedUnit, 3)).toEqual(0.004);
  });
  it('should convert N/(km/h)² to N/(m/s)²', () => {
    const convertedUnit = convertUnits('N/(km/h)²', 'N/(m/s)²', 2);
    expect(convertedUnit).toEqual(25.92);
  });
  it('should convert N/(km/h)² to kN/(km/h)²', () => {
    const convertedUnit = convertUnits('N/(km/h)²', 'kN/(km/h)²', 2);
    expect(floor(convertedUnit, 3)).toEqual(0.002);
  });
  it('should convert kN/(km/h)² to N/(m/s)²', () => {
    const convertedUnit = convertUnits('kN/(km/h)²', 'N/(m/s)²', 0.007);
    expect(convertedUnit).toEqual(90.72);
  });
  it('should convert kN/(km/h)² to N/(km/h)²', () => {
    const convertedUnit = convertUnits('kN/(km/h)²', 'N/(km/h)²', 0.007);
    expect(convertedUnit).toEqual(7);
  });
});
