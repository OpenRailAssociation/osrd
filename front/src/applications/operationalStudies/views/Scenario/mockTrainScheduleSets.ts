import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';

export function randomArrayElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

//
// TRAIN SCHEDULE SET
//
const MOCK_NB_TRAIN_SCHEDULE_SET = 100;

const TRAINSCHEDULESET_NAMES: Array<Pick<TrainScheduleSet, 'name' | 'description'>> = [
  {
    name: '2025 Base V1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  },
  {
    name: '2025 Base V2',
    description: 'Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut labore.',
  },
  {
    name: '2026 Ajusté V1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod.',
  },
  {
    name: '2025 Express V1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
  },
  {
    name: '2026 Express V2',
    description: 'Lorem ipsum dolor sit amet, incididunt ut labore et dolore magna aliqua.',
  },
  {
    name: '2025 Local V1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  },
  {
    name: '2025 Local V2',
    description:
      'Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut labore et dolore.',
  },
  {
    name: '2025 Haute V1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.',
  },
  {
    name: '2026 Haute V2',
    description: 'Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut.',
  },
  {
    name: '2025 Maintenance V1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  },
  {
    name: '2026 Maintenance V2',
    description:
      'Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
];

export const MOCK_TRAIN_SCHEDULE_SETS: TrainScheduleSet[] = [
  ...Array.from(Array(MOCK_NB_TRAIN_SCHEDULE_SET)).map((_, index) => {
    const randomTsName = randomArrayElement(TRAINSCHEDULESET_NAMES);
    return {
      id: index,
      name: randomTsName.name ? `${randomTsName.name} ${index}` : undefined,
      description: randomTsName.description,
      catalog_entry_id: undefined,
      published: Math.random() > 0.8,
    };
  }),

  {
    id: 1000,
    description: 'Jeu sandbox temporaire utilisé pour tests internes.',
    published: false,
  },
];

//
// API MOCK
//

export async function mockListTrainScheduleSet(): Promise<TrainScheduleSet[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_TRAIN_SCHEDULE_SETS);
    }, 1000);
  });
}

// /train_schedule_sets:
export async function mockGetTrainScheduleSets(
  catalogId: number
): Promise<Array<TrainScheduleSet & { train_schedule_count: number }>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = MOCK_TRAIN_SCHEDULE_SETS.filter((e) => e.catalog_entry_id === catalogId);
      resolve(
        result.map((tss) => ({ ...tss, train_schedule_count: Math.round(Math.random() * 10) }))
      );
    }, 100);
  });
}
