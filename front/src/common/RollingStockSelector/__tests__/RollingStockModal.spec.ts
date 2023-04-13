import type { LightRollingStock } from 'common/api/osrdEditoastApi';
import { rollingStockPassesEnergeticModeFilters } from '../RollingStockModal';

type Modes = LightRollingStock['effort_curves']['modes'];

describe('rollingStockPassEnergeticModeFilters', () => {
  describe('both false', () => {
    it('should return true (all rolling stocks are accepted)', () => {
      const filterElec = false;
      const filterThermal = false;
      const modes = {};
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(true);
    });
  });
  describe('electrical true', () => {
    it('should return true if one of the modes is electrical', () => {
      const filterElec = true;
      const filterThermal = false;
      const modes: Modes = { '25000': { is_electric: true } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(true);
    });
    it('should return false if no mode is electrical', () => {
      const filterElec = true;
      const filterThermal = false;
      const modes: Modes = { '25000': { is_electric: false } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(false);
    });
  });
  describe('thermal true', () => {
    it('should return true if one of the modes is thermal', () => {
      const filterElec = false;
      const filterThermal = true;
      const modes: Modes = { '25000': { is_electric: false } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(true);
    });
    it('should return false if no mode is thermal', () => {
      const filterElec = false;
      const filterThermal = true;
      const modes: Modes = { '25000': { is_electric: true } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(false);
    });
  });
  describe('both true', () => {
    it('should return true there exist both an electric and a thermal', () => {
      const filterElec = true;
      const filterThermal = true;
      const modes: Modes = { '25000': { is_electric: true }, '99999': { is_electric: false } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(true);
    });
    it('should return false if there is no thermal', () => {
      const filterElec = true;
      const filterThermal = true;
      const modes: Modes = { '25000': { is_electric: true }, '99999': { is_electric: true } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(false);
    });
    it('should return false if there is no electric', () => {
      const filterElec = true;
      const filterThermal = true;
      const modes: Modes = { '25000': { is_electric: false }, '99999': { is_electric: false } };
      const result = rollingStockPassesEnergeticModeFilters(filterElec, filterThermal, modes);
      expect(result).toBe(false);
    });
  });
});
