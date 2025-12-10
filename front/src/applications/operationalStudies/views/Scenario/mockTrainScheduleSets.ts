import type { CatalogueEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';

export function randomArrayElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

//
// CATALOGUE
//
const MOCK_NB_CATALOGUE_ENTRY = 10;

const CATALOGUE_NAMES = ['Fret Sud', 'Fret Ouest', 'Banlieue Ouest', 'TGV Radial', 'Travaux Nord'];
export const MOCK_CATALOGUE: CatalogueEntry[] = Array.from(Array(MOCK_NB_CATALOGUE_ENTRY)).map(
  (_, index) => ({
    id: index + 1,
    name: `${randomArrayElement(CATALOGUE_NAMES)} ${index}`,
  })
);

export async function mockGetCatalogueEntry(id: number): Promise<CatalogueEntry | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_CATALOGUE.find((e) => e.id === id) || null);
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
      name: randomTsName.name ? `${randomTsName.name} ${index}` : undefined,
      description: randomTsName.description,
      catalogue_entry_id: randomArrayElement(MOCK_CATALOGUE).id,
      published: Math.random() > 0.8,
    };
  }),

  {
    id: 1000,
    description: 'Jeu sandbox temporaire utilisé pour tests internes.',
    published: false,
  },
];

export async function mockListTrainScheduleSet(): Promise<TrainScheduleSet[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_TRAIN_SCHEDULE_SETS);
    }, 1000);
  });
}
