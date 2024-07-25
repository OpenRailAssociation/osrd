import type { ApplicableTrackRange } from '../types';
import { makeSpeedRestrictionTrackRanges } from '../utils';

const trackRanges: ApplicableTrackRange[] = [
  {
    track: 'a',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // trackNode.11191
  {
    track: 'b',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // trackNode.11190
  {
    track: 'c',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // 'trackNode.11189
  {
    track: 'd',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
  // trackNode.11188
  {
    track: 'e',
    begin: 0,
    end: 100,
    applicable_directions: 'STOP_TO_START',
  },
];
const track_nodes = ['track_node.11191', 'track_node.11190', 'track_node.11189', 'track_node.11188'];

describe('makeSpeedRestrictionTrackRanges', () => {
  describe('one selected track node', () => {
    it('should return no track', () => {
      const selectedTrackNodes = {
        'track_node.11189': {
          position: null,
          type: 'point_switch',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        track_nodes,
        selectedTrackNodes
      );
      expect(trackRangesWithBothDirections).toEqual([]);
    });
    it('should return a 10 m long track range with extraMeters', () => {
      const selectedTrackNodes = {
        'track_node.11189': {
          position: null,
          type: 'point_switch',
        },
      };
      const { trackRangesWithBothDirections, returnedExtra } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        track_nodes,
        selectedTrackNodes,
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
  describe('two selected track_nodes', () => {
    it('should get the tracks between given track_nodes', () => {
      const selectedTrackNodes = {
        'track_node.11189': {
          position: null,
          type: 'point_switch',
        },
        'track_node.11191': {
          position: null,
          type: 'link',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        track_nodes,
        selectedTrackNodes
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
    it('should get the tracks between given track_nodes, one is the last track node', () => {
      const selectedTrackNodes = {
        'track_node.11188': {
          position: null,
          type: 'point_switch',
        },
        'track_node.11191': {
          position: null,
          type: 'link',
        },
      };
      const { trackRangesWithBothDirections } = makeSpeedRestrictionTrackRanges(
        trackRanges,
        track_nodes,
        selectedTrackNodes
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
  describe('three selected track_nodes', () => {
    it('should get the tracks between 2 extremes track_nodes', () => {
      const selectedTrackNodes = {
        'track_node.11189': {
          position: null,
          type: 'point_track_node',
        },
        'track_node.11191': {
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
        track_nodes,
        selectedTrackNodes
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
