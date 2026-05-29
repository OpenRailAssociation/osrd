import { describe, it, expect } from 'vitest';

import {
  DEFAULT_TRAIN_PATH_COLORS,
  REST_BACKGROUND_COLOR,
  SELECTED_CURVE_COLOR,
  SELECTED_CURVE_OUTLINE_COLOR,
} from 'applications/operationalStudies/consts';

import getCurveStyle, { INVALID_OUTLINE } from '../getCurveStyle';

const colors = DEFAULT_TRAIN_PATH_COLORS;

describe('getCurveStyle', () => {
  describe('none', () => {
    it('should return the normal color with full opacity', () => {
      const style = getCurveStyle('none', { colors, isSimulated: true });
      expect(style.color).toBe(colors.normal);
      expect(style.opacity).toBe(1);
      expect(style.outline).toBeUndefined();
    });

    it('should label with the normal color, a regular font and a white background', () => {
      const style = getCurveStyle('none', { colors, isSimulated: true });
      expect(style.label).toEqual({
        color: colors.normal,
        fontWeight: 400,
        background: { color: REST_BACKGROUND_COLOR, opacity: 0.9 },
      });
    });

    it('should add the invalid outline when the train is not simulated', () => {
      const style = getCurveStyle('none', { colors, isSimulated: false });
      expect(style.outline).toEqual(INVALID_OUTLINE);
    });

    it('should not add the invalid outline when isSimulated is undefined', () => {
      const style = getCurveStyle('none', { colors });
      expect(style.outline).toBeUndefined();
    });
  });

  describe('active', () => {
    it('should return the active blue color with the active outline', () => {
      const style = getCurveStyle('active', { colors, isSimulated: true });
      expect(style.color).toBe(SELECTED_CURVE_COLOR);
      expect(style.level).toBeUndefined();
      expect(style.opacity).toBe(1);
      expect(style.outline).toEqual({
        offset: 0,
        width: 3,
        color: SELECTED_CURVE_OUTLINE_COLOR,
      });
    });

    it('should label with the hovered color, bold, with a normal-colored border', () => {
      const style = getCurveStyle('active', { colors, isSimulated: true });
      expect(style.label).toEqual({
        color: colors.hovered,
        background: { color: colors.background, border: colors.normal },
        fontWeight: 600,
      });
    });

    it('should replace the active outline with the invalid one when the train is not simulated', () => {
      const style = getCurveStyle('active', { colors, isSimulated: false });
      expect(style.outline).toEqual(INVALID_OUTLINE);
    });
  });
});
