import { describe, expect, test } from 'vitest';

import MacroEditorState from '../MacroEditorState';

describe('MacroEditorState.decodeDomesticReference', () => {
  test('decodes a domestic reference with a country code and secondary code', () => {
    expect(MacroEditorState.decodeDomesticReference('ORL/BV#FR')).toEqual({
      type: 'domestic',
      country_code: 'FR',
      main_code: 'ORL',
      secondary_code: 'BV',
    });
  });

  test('defaults the country code when none is provided', () => {
    expect(MacroEditorState.decodeDomesticReference('ORL/BV')).toEqual({
      type: 'domestic',
      country_code: '??',
      main_code: 'ORL',
      secondary_code: 'BV',
    });
  });

  test('decodes a domestic reference without a secondary code', () => {
    expect(MacroEditorState.decodeDomesticReference('ORL#FR')).toEqual({
      type: 'domestic',
      country_code: 'FR',
      main_code: 'ORL',
      secondary_code: undefined,
    });
  });
});

describe('MacroEditorState.parseNodeLocation', () => {
  test('wraps an operational point reference node location into a PathItemLocation', () => {
    expect(
      MacroEditorState.parseNodeLocation({
        type: 'domestic',
        main_code: 'ORL',
        secondary_code: 'BV',
        country_code: 'FR',
      })
    ).toEqual({
      type: 'operational_point_part_reference',
      operational_point: {
        type: 'domestic',
        main_code: 'ORL',
        secondary_code: 'BV',
        country_code: 'FR',
      },
    });
  });

  test('keeps a track_offset node location as-is', () => {
    const trackOffset = { type: 'track_offset' as const, track: 'T1', offset: 42 };
    expect(MacroEditorState.parseNodeLocation(trackOffset)).toEqual(trackOffset);
  });
});
