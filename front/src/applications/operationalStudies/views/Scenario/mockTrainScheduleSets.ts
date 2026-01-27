import type { CatalogEntry } from 'common/api/osrdEditoastApi';

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

//
// API MOCK
//

// GET /catalogue_entry/
export async function mockListCatalogEntries(): Promise<CatalogEntry[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_CATALOG);
    }, 1000);
  });
}
