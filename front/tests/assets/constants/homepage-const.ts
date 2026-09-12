import { readJsonFile } from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';

const {
  home: { applications },
} = readJsonFile<{ home: { applications: FlatTranslations } }>(
  'public/locales/fr/translation.json'
);

export const EXPECTED_HOME_LINKS = [
  applications['operational-studies'],
  applications['infrastructures-editor'],
  applications['rolling-stocks-editor'],
  applications['reference-map'],
  applications.stdcm,
];

export const HOME_URLS = {
  home: '/',
  operationalStudies: /.*\/operational-studies/,
  map: /.*\/map/,
  editor: /.*\/editor\/*/,
  stdcm: /.*\/stdcm/,
  rollingStockEditor: /.*\/rolling-stock-editor/,
};
