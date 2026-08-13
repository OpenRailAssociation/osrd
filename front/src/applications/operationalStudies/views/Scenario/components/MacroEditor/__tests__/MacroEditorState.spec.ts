import { describe, expect, test } from 'vitest';

import MacroEditorState from '../MacroEditorState';

describe('MacroEditorState.parsePathKey', () => {
  test('parses a domestic path key with a country code and secondary code', () => {
    expect(MacroEditorState.parsePathKey('domestic:ORL/BV#FR')).toEqual({
      type: 'operational_point_part_reference',
      operational_point: {
        type: 'domestic',
        country_code: 'FR',
        main_code: 'ORL',
        secondary_code: 'BV',
      },
    });
  });

  test('defaults the country code when none is provided', () => {
    expect(MacroEditorState.parsePathKey('domestic:ORL/BV')).toEqual({
      type: 'operational_point_part_reference',
      operational_point: {
        type: 'domestic',
        country_code: '??',
        main_code: 'ORL',
        secondary_code: 'BV',
      },
    });
  });

  test('parses a domestic path key without a secondary code', () => {
    expect(MacroEditorState.parsePathKey('domestic:ORL#FR')).toEqual({
      type: 'operational_point_part_reference',
      operational_point: {
        type: 'domestic',
        country_code: 'FR',
        main_code: 'ORL',
        secondary_code: undefined,
      },
    });
  });
});
