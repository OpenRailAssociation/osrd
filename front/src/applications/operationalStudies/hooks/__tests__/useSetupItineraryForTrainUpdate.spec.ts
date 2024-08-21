import type { PathfindingResult } from 'common/api/osrdEditoastApi';

import { updatePathStepsFromOperationalPoints } from '../useSetupItineraryForTrainUpdate';

describe('updatePathStepsFrom', () => {
  const suggestedOpPoints = [
    {
      opId: 'd9c92cb4-6667-11e3-89ff-01f464e0362d',
      name: 'Grenadille',
      uic: 87747006,
      ch: 'BV',
      kp: '130+538',
      ci: 747006,
      trigram: 'GE',
      offsetOnTrack: 301,
      track: '60bca110-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 0,
      coordinates: [5.714214596139134, 45.191404467130226],
    },
    {
      opId: 'd9b38600-6667-11e3-89ff-01f464e0362d',
      name: 'Grenadille',
      uic: 87747006,
      ch: 'FP',
      kp: '130+100',
      ci: 747006,
      trigram: 'GE',
      offsetOnTrack: 60,
      track: '646dc21a-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 438000,
      coordinates: [5.712418028581643, 45.195158714174944],
    },
    {
      opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
      name: 'Grenadille',
      uic: 87747006,
      ch: 'P2',
      kp: '129+952',
      ci: 747006,
      trigram: 'GE',
      offsetOnTrack: 170,
      track: '60bc8cea-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 586000,
      coordinates: [5.711846462951984, 45.19643525506182],
    },
    {
      opId: 'd9cdd03e-6667-11e3-89ff-01f464e0362d',
      name: 'Grenadille',
      uic: 87747006,
      ch: 'PB',
      kp: '127+747',
      ci: 747006,
      trigram: 'GE',
      offsetOnTrack: 628,
      track: '6296a7ce-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 2791000,
      coordinates: [5.697161247332329, 45.21232961560229],
    },
    {
      opId: '36239402-c97c-11e7-a9ff-012864e0362d',
      name: 'Grenadille',
      uic: 87747006,
      ch: '3M',
      kp: '127+230',
      ci: 747006,
      trigram: 'GE',
      offsetOnTrack: 111,
      track: '6296a7ce-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 3308000,
      coordinates: [5.691518613904571, 45.21479799205003],
    },
    {
      opId: 'd9c4227a-6667-11e3-89ff-01f464e0362d',
      name: 'Grenadille',
      uic: 87747006,
      ch: 'P1',
      kp: '126+875',
      ci: 747006,
      trigram: 'GE',
      offsetOnTrack: 84,
      track: '62969d98-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 3663000,
      coordinates: [5.6876365310009325, 45.21648454851051],
    },
    {
      opId: 'd982df3e-6667-11e3-89ff-01f464e0362d',
      name: 'St-Égrève-St-Robert',
      uic: 87747352,
      ch: 'BV',
      kp: '124+250',
      ci: 747352,
      trigram: 'SEG',
      offsetOnTrack: 222,
      track: '6296897e-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 6288000,
      coordinates: [5.671070500262156, 45.236082414368255],
    },
    {
      opId: 'd9dfbdbe-6667-11e3-89ff-01f464e0362d',
      name: 'St-Égrève-St-Robert',
      uic: 87747352,
      ch: 'EP',
      kp: '122+725',
      ci: 747352,
      trigram: 'SEG',
      offsetOnTrack: 4474,
      track: '62967baa-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 7813000,
      coordinates: [5.662275216347161, 45.24824534312752],
    },
    {
      opId: 'd9e3ba92-6667-11e3-89ff-01f464e0362d',
      name: 'Les Chartreux',
      uic: 87745372,
      ch: '00',
      kp: '118+258',
      ci: 745372,
      trigram: 'PMX',
      offsetOnTrack: 7,
      track: '62967baa-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 12280000,
      coordinates: [5.636384812820529, 45.28427001800476],
    },
    {
      opId: 'd9af111e-6667-11e3-89ff-01f464e0362d',
      name: 'Voreppe',
      uic: 87747337,
      ch: 'BV',
      kp: '117+422',
      ci: 747337,
      trigram: 'VPE',
      offsetOnTrack: 4589,
      track: '62967024-6667-11e3-81ff-01f464e0362d',
      positionOnPath: 13116000,
      coordinates: [5.631369628448958, 45.29094364381627],
    },
  ];

  describe('pathSteps created from osrd', () => {
    it('should not confuse pathSteps with the same uic', () => {
      const pathSteps = [
        {
          id: 'id79',
          deleted: false,
          uic: 87747006,
          ch: 'BV',
          name: '87747006',
        },
        {
          id: 'id87',
          deleted: false,
          uic: 87747006,
          ch: 'P2',
          name: '87747006',
          arrival: '15:00:00',
          stopFor: null,
        },
        {
          id: 'id80',
          deleted: false,
          uic: 87747337,
          ch: 'BV',
          name: '87747337',
          arrival: null,
          stopFor: '0',
        },
      ];
      const pathFindingResult = {
        path_item_positions: [0, 586000, 13116000],
      };
      const stepsCoordinates = [
        [5.714214596139134, 45.191404467130226],
        [5.711846462951984, 45.19643525506182],
        [5.631369628448958, 45.29094364381627],
      ];
      const result = updatePathStepsFromOperationalPoints(
        pathSteps,
        suggestedOpPoints,
        pathFindingResult as Extract<PathfindingResult, { status: 'success' }>,
        stepsCoordinates
      );
      const expected = [
        {
          id: 'id79',
          deleted: false,
          uic: 87747006,
          ch: 'BV',
          name: 'Grenadille',
          kp: '130+538',
          positionOnPath: 0,
          coordinates: [5.714214596139134, 45.191404467130226],
        },
        {
          id: 'id87',
          deleted: false,
          uic: 87747006,
          ch: 'P2', // should not be BV here, it has the same uic but not the same ch
          name: 'Grenadille',
          arrival: '15:00:00',
          stopFor: null,
          kp: '129+952',
          positionOnPath: 586000,
          coordinates: [5.711846462951984, 45.19643525506182],
        },
        {
          id: 'id80',
          deleted: false,
          uic: 87747337,
          ch: 'BV',
          name: 'Voreppe',
          arrival: null,
          stopFor: '0',
          kp: '117+422',
          positionOnPath: 13116000,
          coordinates: [5.631369628448958, 45.29094364381627],
        },
      ];
      expect(result).toEqual(expected);
    });
  });
  describe('pathSteps created from NGE', () => {
    it('should update just as well', () => {
      const pathSteps = [
        {
          id: 'whatev-0',
          trigram: 'GE',
          secondary_code: 'BV',
          name: '87747006',
        },
        {
          id: 'whatev-1',
          trigram: 'GE',
          secondary_code: 'P2',
          name: '87747006',
          arrival: '15:00:00',
        },
        {
          id: 'who-0',
          trigram: 'VPE',
          secondary_code: 'BV',
          name: '87747337',
        },
      ];
      const pathFindingResult = {
        path_item_positions: [0, 586000, 13116000],
      };
      const stepsCoordinates = [
        [5.714214596139134, 45.191404467130226],
        [5.711846462951984, 45.19643525506182],
        [5.631369628448958, 45.29094364381627],
      ];
      const result = updatePathStepsFromOperationalPoints(
        pathSteps,
        suggestedOpPoints,
        pathFindingResult as Extract<PathfindingResult, { status: 'success' }>,
        stepsCoordinates
      );
      const expected = [
        {
          id: 'whatev-0',
          ch: 'BV',
          trigram: 'GE',
          secondary_code: 'BV',
          name: 'Grenadille',
          kp: '130+538',
          positionOnPath: 0,
          coordinates: [5.714214596139134, 45.191404467130226],
        },
        {
          id: 'whatev-1',
          ch: 'P2',
          trigram: 'GE',
          secondary_code: 'P2',
          name: 'Grenadille',
          arrival: '15:00:00',
          kp: '129+952',
          positionOnPath: 586000,
          coordinates: [5.711846462951984, 45.19643525506182],
        },
        {
          id: 'who-0',
          ch: 'BV',
          secondary_code: 'BV',
          trigram: 'VPE',
          name: 'Voreppe',
          kp: '117+422',
          positionOnPath: 13116000,
          coordinates: [5.631369628448958, 45.29094364381627],
        },
      ];
      expect(result).toEqual(expected);
    });

    it('should handle missing corresponding OPs', () => {
      const pathSteps = [
        {
          id: 'whatev-0',
          trigram: 'GE',
          ch: 'BV',
          name: '87747006',
        },
        {
          id: 'whatev-1',
          trigram: 'GE',
          ch: 'P2',
          name: '87747006',
          arrival: '15:00:00',
        },
        {
          id: 'who-0',
          trigram: 'VPE',
          ch: 'BV',
          name: '87747337',
        },
      ];
      const pathFindingResult = {
        path_item_positions: [0, 586000, 13116000],
      };
      const stepsCoordinates = [
        [5.714214596139134, 45.191404467130226],
        [5.711846462951984, 45.19643525506182],
        [5.631369628448958, 45.29094364381627],
      ];
      const result = updatePathStepsFromOperationalPoints(
        pathSteps,
        [],
        pathFindingResult as Extract<PathfindingResult, { status: 'success' }>,
        stepsCoordinates
      );
      const expected = [
        {
          id: 'whatev-0',
          ch: 'BV',
          trigram: 'GE',
          name: '87747006',
          kp: undefined,
          positionOnPath: 0,
          coordinates: [5.714214596139134, 45.191404467130226],
        },
        {
          id: 'whatev-1',
          ch: 'P2',
          trigram: 'GE',
          name: '87747006',
          arrival: '15:00:00',
          kp: undefined,
          positionOnPath: 586000,
          coordinates: [5.711846462951984, 45.19643525506182],
        },
        {
          id: 'who-0',
          ch: 'BV',
          trigram: 'VPE',
          name: '87747337',
          kp: undefined,
          positionOnPath: 13116000,
          coordinates: [5.631369628448958, 45.29094364381627],
        },
      ];
      expect(result).toEqual(expected);
    });
  });
});
