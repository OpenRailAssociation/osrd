import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';

import { glob } from 'glob';
import * as I18nextParser from 'i18next-parser';
import { jsonKeyPathList } from 'json-key-path-list';
import vfs from 'vinyl-fs';

const IGNORE_MISSING: RegExp[] = [
  // key used by a t function in modules/trainschedule/components/ManageTrainSchedule/helpers/checkCurrentConfig.ts
  /translation:errorMessages\..*/,
  /translation:error/,
  /translation:default/,
  /translation:error/,
  /translation:unspecified/,
  // key used by upsertMapWaypointsInOperationalPoints
  /translation:requestedPoint/,
  // key used by checkStdcmConfigErrors
  /translation:arriveAt/,
  /translation:departureTime/,
  /translation:destinationTime/,
  /translation:leaveAt/,
];
const IGNORE_UNUSED: RegExp[] = [
  /.*-generated$/,
  /.*\.generated\..*$/,
  /errors:.*/, // Errors are generated and used dynamicly
  /infraEditor:.*/, // Translation of properties object for the form
  /infraEditor:__main____.*/, // Found by error by i18n parser in a json-schema
  /translation:Editor\.tools\..*/, // Editor tool's label are generated
  /translation:Editor.obj-types\..*/, // Type of object are translated dynamicly on the sumpup popin
  /translation:Editor.directions\..*/,
  /translation:Editor.layers\..*/,
  /Editor\.item-statuses\..*/,
  /translation:Editor\.infra-errors\.error-type\..*/, // Infra error types are generated
  /translation:Editor\.infra-errors\.error-level\..*/, // Infra error level are generated
  /translation:Editor\.infra-errors\.corrector-modal\..*/,
  /home\/navbar:language\..*/, // Language selector which is generated with the locale
];

/**
 * Read a file and returns its content as a JSON
 */
async function readJsonFile<T extends { [key: string]: unknown }>(filePath: string): Promise<T> {
  const data = await readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Given a locales folder, return the list of all i18n keys.
 */
async function getLocalesKeys(localePath: string, locale: string): Promise<Set<string>> {
  const pathForLocale = `${localePath}/${locale}/`;
  const files = await glob(`${pathForLocale}/**/*.json`);
  const allKeys = (
    await Promise.all(
      files.map(async (file) => {
        const data = await readJsonFile(file);
        const namespace = file.replace(pathForLocale, '').replace(/\.json$/, '');
        return jsonKeyPathList(data).map(
          (key) => `${namespace}:${key.replace(/_(zero|one|other|many)$/, '')}`
        );
      })
    )
  )
    .flat()
    .sort();
  return new Set(allKeys);
}

/**
 * Scan the source code and generate a locale folder structure
 * in a temp folder, with all the i18n key found.
 *
 * @returns The location of the temp folder
 */
async function scanCode(): Promise<string> {
  const tempDir = await mkdtemp(`${os.tmpdir()}/osrd-i18n-`);
  return new Promise((resolve, reject) => {
    const stream = vfs
      .src(`${process.cwd()}/src/**/*.{ts,tsx}`)
      .pipe(
        // eslint-disable-next-line
        new (I18nextParser as any).gulp({
          locales: ['dev'],
          output: '$LOCALE/$NAMESPACE.json',
        })
      )
      .pipe(vfs.dest(tempDir));

    stream.on('finish', () => resolve(tempDir));
    stream.on('error', (e: Error) => reject(e));
  });
}

/**
 * The script execution
 */
async function run() {
  try {
    const keysByLocale = await Promise.all(
      ['fr', 'en'].map(async (locale) => {
        const keys = await getLocalesKeys(`${process.cwd()}/public/locales`, locale);
        return { locale, keys };
      })
    );

    const scannedLocalePath = await scanCode();
    const scannedNamespacedKeys = await getLocalesKeys(scannedLocalePath, 'dev');

    // Search for unused keys
    const unusedKeys: Array<{ locale: string; key: string }> = [];
    keysByLocale.forEach(({ locale, keys }) => {
      keys.forEach((key) => {
        if (
          !scannedNamespacedKeys.has(key) &&
          IGNORE_UNUSED.every((pattern) => !key.match(pattern))
        ) {
          unusedKeys.push({ locale, key });
        }
      });
    });

    // Search for missing traduction
    const missingKeys: Array<{ locale: string; key: string }> = [];
    scannedNamespacedKeys.forEach((key) => {
      if (IGNORE_MISSING.every((pattern) => !key.match(pattern))) {
        keysByLocale.forEach(({ locale, keys }) => {
          if (!keys.has(key)) {
            missingKeys.push({ locale, key });
          }
        });
      }
    });

    /* eslint-disable no-console */
    if (unusedKeys.length > 0) {
      console.warn(`Unused keys (${unusedKeys.length})`);
      console.warn('----------------------------------');
      console.warn(unusedKeys.map((e) => `${e.locale}:${e.key}`).join('\n'));
      console.warn();
    }

    if (missingKeys.length > 0) {
      console.warn(`Missing keys (${missingKeys.length})`);
      console.warn('------------------------------------');
      console.warn(missingKeys.map((e) => `${e.locale}:${e.key}`).join('\n'));
      console.warn();
      console.warn('/!\\ Failed: missing keys are not allowed in fr & en');
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    process.exit();
  }
}

run();
