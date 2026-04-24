import type { LevelCrossingData } from '@osrd-project/ui-charts';

import { MINUTE, SECOND } from '../common/const';

export const START_DATE = new Date('2026-01-12');

export const levelCrossingData: LevelCrossingData[] = [
  {
    name: 'Level Crossing A',
    occupancies: [
      [
        {
          startTime: +START_DATE,
          endTime: +START_DATE + 3 * MINUTE,
          trainNames: ['TS 1234'],
        },
      ],

      [
        {
          startTime: +START_DATE + 20 * MINUTE,
          endTime: +START_DATE + 25 * MINUTE,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 25 * MINUTE + 10 * SECOND,
          endTime: +START_DATE + 27 * MINUTE + 50 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],

      [
        {
          startTime: +START_DATE + 30 * MINUTE,
          endTime: +START_DATE + 35 * MINUTE,
          trainNames: ['TS 1234', 'TS 5678'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing B',
    occupancies: [
      [
        {
          startTime: +START_DATE + 2 * MINUTE + 30 * SECOND,
          endTime: +START_DATE + 4 * MINUTE + 30 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 4 * MINUTE + 40 * SECOND,
          endTime: +START_DATE + 5 * MINUTE + 50 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 10 * MINUTE + 40 * SECOND,
          endTime: +START_DATE + 12 * MINUTE + 35 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 15 * MINUTE,
          endTime: +START_DATE + 18 * MINUTE,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 18 * MINUTE + 15 * SECOND,
          endTime: +START_DATE + 19 * MINUTE + 30 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],

      [
        {
          startTime: +START_DATE + 25 * MINUTE,
          endTime: +START_DATE + 26 * MINUTE + 30 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing C',
    occupancies: [
      [
        {
          startTime: +START_DATE + 5 * MINUTE,
          endTime: +START_DATE + 8 * MINUTE,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 12 * MINUTE + 20 * SECOND,
          endTime: +START_DATE + 14 * MINUTE + 45 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 27 * MINUTE,
          endTime: +START_DATE + 28 * MINUTE + 49 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 29 * MINUTE,
          endTime: +START_DATE + 31 * MINUTE + 15 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing D',
    occupancies: [
      [
        {
          startTime: +START_DATE + 1 * MINUTE + 15 * SECOND,
          endTime: +START_DATE + 5 * MINUTE + 45 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 6 * MINUTE,
          endTime: +START_DATE + 7 * MINUTE + 20 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 16 * MINUTE + 30 * SECOND,
          endTime: +START_DATE + 19 * MINUTE,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 29 * MINUTE,
          endTime: +START_DATE + 32 * MINUTE + 40 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing E',
    occupancies: [
      [
        {
          startTime: +START_DATE + 8 * MINUTE + 10 * SECOND,
          endTime: +START_DATE + 11 * MINUTE + 25 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 17 * MINUTE,
          endTime: +START_DATE + 20 * MINUTE + 15 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 20 * MINUTE + 30 * SECOND,
          endTime: +START_DATE + 22 * MINUTE + 50 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 33 * MINUTE,
          endTime: +START_DATE + 36 * MINUTE,
          trainNames: ['TS 1234'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing F',
    occupancies: [
      [
        {
          startTime: +START_DATE + 3 * MINUTE + 20 * SECOND,
          endTime: +START_DATE + 6 * MINUTE + 40 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 13 * MINUTE + 15 * SECOND,
          endTime: +START_DATE + 15 * MINUTE + 50 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 16 * MINUTE,
          endTime: +START_DATE + 17 * MINUTE + 30 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 26 * MINUTE + 20 * SECOND,
          endTime: +START_DATE + 29 * MINUTE,
          trainNames: ['TS 1234'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing G',
    occupancies: [
      [
        {
          startTime: +START_DATE + 4 * MINUTE,
          endTime: +START_DATE + 6 * MINUTE + 38 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 6 * MINUTE + 45 * SECOND,
          endTime: +START_DATE + 11 * MINUTE + 50 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 19 * MINUTE + 10 * SECOND,
          endTime: +START_DATE + 21 * MINUTE + 40 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 27 * MINUTE,
          endTime: +START_DATE + 28 * MINUTE + 45 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 34 * MINUTE,
          endTime: +START_DATE + 37 * MINUTE + 20 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 44 * MINUTE,
          endTime: +START_DATE + 47 * MINUTE + 20 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 49 * MINUTE,
          endTime: +START_DATE + 52 * MINUTE + 20 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 54 * MINUTE,
          endTime: +START_DATE + 57 * MINUTE + 20 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
    ],
  },
  {
    name: 'Level Crossing H',
    occupancies: [
      [
        {
          startTime: +START_DATE,
          endTime: +START_DATE + 3 * MINUTE,
          trainNames: ['TS 1234'],
        },
      ],

      [
        {
          startTime: +START_DATE + 20 * MINUTE,
          endTime: +START_DATE + 25 * MINUTE,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 25 * MINUTE + 10 * SECOND,
          endTime: +START_DATE + 27 * MINUTE + 50 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 30 * MINUTE,
          endTime: +START_DATE + 35 * MINUTE,
          trainNames: ['TS 1234', 'TS 5678'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing I',
    occupancies: [
      [
        {
          startTime: +START_DATE + 2 * MINUTE + 30 * SECOND,
          endTime: +START_DATE + 4 * MINUTE + 30 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 4 * MINUTE + 40 * SECOND,
          endTime: +START_DATE + 5 * MINUTE + 50 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 10 * MINUTE + 40 * SECOND,
          endTime: +START_DATE + 12 * MINUTE + 35 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 15 * MINUTE,
          endTime: +START_DATE + 18 * MINUTE,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 18 * MINUTE + 15 * SECOND,
          endTime: +START_DATE + 19 * MINUTE + 30 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 25 * MINUTE,
          endTime: +START_DATE + 26 * MINUTE + 30 * SECOND,
          trainNames: ['TS 1234'],
        },
      ],
    ],
  },

  {
    name: 'Level Crossing J',
    occupancies: [
      [
        {
          startTime: +START_DATE + 5 * MINUTE,
          endTime: +START_DATE + 8 * MINUTE,
          trainNames: ['TS 1234'],
        },
      ],
      [
        {
          startTime: +START_DATE + 12 * MINUTE + 20 * SECOND,
          endTime: +START_DATE + 14 * MINUTE + 45 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
      [
        {
          startTime: +START_DATE + 27 * MINUTE,
          endTime: +START_DATE + 28 * MINUTE + 49 * SECOND,
          trainNames: ['TS 1234'],
        },
        {
          startTime: +START_DATE + 29 * MINUTE,
          endTime: +START_DATE + 31 * MINUTE + 15 * SECOND,
          trainNames: ['TS 5678'],
        },
      ],
    ],
  },
];
