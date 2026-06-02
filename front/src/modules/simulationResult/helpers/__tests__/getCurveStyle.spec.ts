import { describe, it, expect } from 'vitest';

import {
  DEFAULT_TRAIN_PATH_COLORS,
  DRAGGED_CURVE_COLOR,
  DRAGGED_CURVE_OUTLINE_COLOR,
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

  describe('passivePrimary', () => {
    it('should return the category color with a background-colored outline', () => {
      const style = getCurveStyle('passivePrimary', { colors, isSimulated: true });
      expect(style.color).toBe(colors.normal);
      expect(style.level).toBeUndefined();
      expect(style.opacity).toBe(1);
      expect(style.outline).toEqual({
        offset: 0,
        width: 3,
        color: colors.background,
      });
    });

    it('should label like active: hovered color, bold, with a normal-colored border', () => {
      const style = getCurveStyle('passivePrimary', { colors, isSimulated: true });
      expect(style.label).toEqual({
        color: colors.hovered,
        background: { color: colors.background, border: colors.normal },
        fontWeight: 600,
      });
    });

    it('should replace the outline with the invalid one when the train is not simulated', () => {
      const style = getCurveStyle('passivePrimary', { colors, isSimulated: false });
      expect(style.outline).toEqual(INVALID_OUTLINE);
    });
  });

  describe('passiveSecondary', () => {
    it('should return the normal color with a thin background-colored outline', () => {
      const style = getCurveStyle('passiveSecondary', { colors, isSimulated: true });
      expect(style.color).toBe(colors.normal);
      expect(style.opacity).toBe(1);
      expect(style.outline).toEqual({
        offset: 0,
        width: 2,
        color: colors.background,
      });
    });

    it('should label with the hovered color and a normal-colored border on the background', () => {
      const style = getCurveStyle('passiveSecondary', { colors, isSimulated: true });
      expect(style.label).toEqual({
        color: colors.hovered,
        background: { color: colors.background, border: colors.normal },
        fontWeight: 400,
      });
    });

    it('should replace the outline with the invalid one when the train is not simulated', () => {
      const style = getCurveStyle('passiveSecondary', { colors, isSimulated: false });
      expect(style.outline).toEqual(INVALID_OUTLINE);
    });
  });

  describe('drag', () => {
    it('should return the dark navy color at level 1 with the yellow halo outline', () => {
      const style = getCurveStyle('drag', { colors, isSimulated: true });
      expect(style.color).toBe(DRAGGED_CURVE_COLOR);
      expect(style.level).toBe(1);
      expect(style.opacity).toBe(1);
      expect(style.outline).toEqual({
        offset: 0,
        width: 1.5,
        color: DRAGGED_CURVE_OUTLINE_COLOR,
      });
    });

    it('should keep the active selection label', () => {
      const style = getCurveStyle('drag', { colors, isSimulated: true });
      expect(style.label).toEqual({
        color: colors.normal,
        background: { color: colors.background },
        fontWeight: 600,
      });
    });
  });

  describe('out of selection', () => {
    it('should use the background tint for the curve and the label', () => {
      const style = getCurveStyle('none', { colors, isSimulated: true }, { outOfSelection: true });
      expect(style.color).toBe(colors.background);
      expect(style.label).toEqual({
        color: colors.background,
        fontWeight: 400,
        background: { color: REST_BACKGROUND_COLOR, opacity: 0.9 },
      });
    });

    it('should have no outline', () => {
      const style = getCurveStyle('none', { colors, isSimulated: false }, { outOfSelection: true });
      expect(style.outline).toBeUndefined();
    });

    it('should ignore the state when out of selection', () => {
      const fromActive = getCurveStyle(
        'active',
        { colors, isSimulated: true },
        { outOfSelection: true }
      );
      const fromNone = getCurveStyle(
        'none',
        { colors, isSimulated: true },
        { outOfSelection: true }
      );
      expect(fromActive).toEqual(fromNone);
    });

    it('should leave the base style untouched when not out of selection', () => {
      const style = getCurveStyle('none', { colors, isSimulated: true }, { outOfSelection: false });
      expect(style.color).toBe(colors.normal);
      expect(style.label).toEqual({
        color: colors.normal,
        fontWeight: 400,
        background: { color: REST_BACKGROUND_COLOR, opacity: 0.9 },
      });
    });
  });

  describe('hover modifier', () => {
    it('should switch a none-state curve to the hovered tint at level 3', () => {
      const style = getCurveStyle('none', { colors, isSimulated: true }, { hovered: true });
      expect(style.color).toBe(colors.hovered);
      expect(style.level).toBe(3);
      expect(style.opacity).toBe(1);
      expect(style.outline).toBeUndefined();
      expect(style.label).toEqual({
        color: colors.hovered,
        background: { color: colors.background },
        fontWeight: 400,
      });
    });

    it('should add the invalid outline when a hovered none-state train is not simulated', () => {
      const style = getCurveStyle('none', { colors, isSimulated: false }, { hovered: true });
      expect(style.outline).toEqual(INVALID_OUTLINE);
    });

    it.each(['active', 'passivePrimary', 'passiveSecondary', 'drag'] as const)(
      'should not change anything when hovering a %s curve',
      (state) => {
        const base = getCurveStyle(state, { colors, isSimulated: true });
        const hovered = getCurveStyle(state, { colors, isSimulated: true }, { hovered: true });
        expect(hovered).toEqual(base);
      }
    );

    it('should win over outOfSelection on a none-state curve', () => {
      const fromHover = getCurveStyle(
        'none',
        { colors, isSimulated: true },
        { hovered: true, outOfSelection: true }
      );
      const onlyHover = getCurveStyle('none', { colors, isSimulated: true }, { hovered: true });
      expect(fromHover).toEqual(onlyHover);
    });
  });
});
