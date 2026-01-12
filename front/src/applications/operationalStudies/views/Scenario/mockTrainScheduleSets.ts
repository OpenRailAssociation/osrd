import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';

export function randomArrayElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

//
// CATALOG
//
const MOCK_NB_CATALOG_ENTRY = 10;

const CATALOG_NAMES = ['Fret Sud', 'Fret Ouest', 'Banlieue Ouest', 'TGV Radial', 'Travaux Nord'];
export const MOCK_CATALOG: CatalogEntry[] = Array.from(Array(MOCK_NB_CATALOG_ENTRY)).map(
  (_, index) => ({
    id: index + 1,
    name: `${randomArrayElement(CATALOG_NAMES)} ${index}`,
  })
);

export async function mockGetCatalogEntry(id: number): Promise<CatalogEntry | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_CATALOG.find((e) => e.id === id) || null);
    }, 1000);
  });
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
      name: `${randomTsName.name} ${index}`,
      description: randomTsName.description,
      catalog_entry_id: randomArrayElement(MOCK_CATALOG).id,
      published: Math.random() > 0.8,
    };
  }),
];

export async function mockListTrainScheduleSet(): Promise<TrainScheduleSet[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_TRAIN_SCHEDULE_SETS);
    }, 1000);
  });
}
