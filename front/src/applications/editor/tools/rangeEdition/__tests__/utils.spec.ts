import type { ApplicableTrackRange } from '../types';
import { makeSpeedRestrictionTrackRanges } from '../utils';

const trackRanges: ApplicableTrackRange[] = [
  {
    track: 'a',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // switch.11191
  {
    track: 'b',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // switch.11190
  {
    track: 'c',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // 'switch.11189
  {
    track: 'd',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // switch.11188
  {
    track: 'e',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
];
const switches = ['switch.11191', 'switch.11190', 'switch.11189', 'switch.11188'];

describe('makeSpeedRestrictionTrackRanges', () => {
  describe('one selected switch', () => {
    it('should return no track', () => {
      const selectedSwitches = {
        'switch.11189': {
          position: null,
          type: 'point_switch',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        switches,
        selectedSwitches
      );
      expect(trackRangesWithBothDirections).toEqual([]);
    });
    it('should return a 10 m long track range with extraMeters', () => {
      const selectedSwitches = {
        'switch.11189': {
          position: null,
          type: 'point_switch',
        },
      };
      const { trackRangesWithBothDirections, returnedExtra } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        switches,
        selectedSwitches,
        true
      );
      expect(returnedExtra).toBe(true);
      expect(trackRangesWithBothDirections).toEqual([
        {
          track: 'd',
          begin: 90,
          end: 100,
          applicable_directions: 'BOTH',
        },
      ]);
    });
  });
  describe('two selected switches', () => {
    it('should get the tracks between given switches', () => {
      const selectedSwitches = {
        'switch.11189': {
          position: null,
          type: 'point_switch',
        },
        'switch.11191': {
          position: null,
          type: 'link',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        switches,
        selectedSwitches
      );
      expect(trackRangesWithBothDirections).toEqual([
        {
          track: 'b',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
        {
          track: 'c',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
      ]);
    });
    it('should get the tracks between given switches, one is the last switch', () => {
      const selectedSwitches = {
        'switch.11188': {
          position: null,
          type: 'point_switch',
        },
        'switch.11191': {
          position: null,
          type: 'link',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        switches,
        selectedSwitches
      );
      expect(trackRangesWithBothDirections).toEqual([
        {
          track: 'b',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
        {
          track: 'c',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
        {
          track: 'd',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
      ]);
    });
  });
  describe('three selected switches', () => {
    it('should get the tracks between 2 extremes switches', () => {
      const selectedSwitches = {
        'switch.11189': {
          position: null,
          type: 'point_switch',
        },
        'switch.11191': {
          position: null,
          type: 'link',
        },
        'switch.11190': {
          position: null,
          type: 'point_switch',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        switches,
        selectedSwitches
      );
      expect(trackRangesWithBothDirections).toEqual([
        {
          track: 'b',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
        {
          track: 'c',
          begin: 0,
          end: 100,
          applicable_directions: 'BOTH',
        },
      ]);
    });
  });
});
