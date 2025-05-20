/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'glob';
import { jsonKeyPathList } from 'json-key-path-list';
import * as ts from 'typescript';

const LANGUAGES = ['en', 'fr'];

const IGNORE_MISSING: RegExp[] = [
  /translation:unspecified/,
  /stdcm-help-section:asu/,
  /stdcm-help-section:sections/,
];

const IGNORE_UNUSED: RegExp[] = [
  /errors:.*/, // Errors are generated and used dynamicly
  /infraEditor:.*/, // Translation of properties object for the form
  /infraEditor:__main____.*/, // Found by error by i18n parser in a json-schema
  /translation:Editor\.tools\..*/, // Editor tool's label are generated
  /translation:Editor.obj-types\..*/, // Type of object are translated dynamicly on the sumpup popin
  /translation:Editor.directions\..*/,
  /translation:Editor.layers\..*/,
  /translation:common.map-actions\..*/,
  /Editor\.item-statuses\..*/,
  /translation:Editor\.infra-errors\.error-type\..*/, // Infra error types are generated
  /translation:Editor\.infra-errors\.error-level\..*/, // Infra error level are generated
  /translation:Editor\.infra-errors\.list\..*/, // Total-error keys are generated
  /translation:Editor\.infra-errors\.corrector-modal\..*/,
  /translation:nav-bar.language\..*/, // Language selector which is generated with the locale

  // Authorization
  /translation:authorization\.grants\..*/,

  // Map
  /translation:mapKey.alternatingCurrent/,
  /translation:mapKey.directCurrent/,
  /translation:mapSettings.layers\..*/,

  // Manage train schedule
  /operational-studies:manageTrainSchedule.errorMessages\..*/,
  /operational-studies:manageTrainSchedule.incompatibleConstraints\..*/,
  /operational-studies:manageTrainSchedule.pathfindingErrors\..*/,
  /operational-studies:manageTrainSchedule.tabs\..*/,

  // Operational studies management
  /operational-studies:.*.delete/,
  /operational-studies:.*.confirm-delete/,
  /operational-studies:.*.unselect-all/,
  /operational-studies:.*.create/,
  /operational-studies:.*.select/,

  // Project
  /operational-studies:main\.Routing/,
  /operational-studies:main\.Spacing/,
  /operational-studies:main\.pacedTrain/,
  /operational-studies:main\.pacedTrainCount/,
  /operational-studies:main\.timetable\.invalid\..*/,
  /operational-studies:main\.timetable\.occurrenceChangeGroup\..*/,
  /operational-studies:main\.train/,
  /operational-studies:main\.trainCount/,
  /operational-studies:main\.timetable\.occurrenceChangeGroup\..*/,

  // Study
  /operational-studies:study\.date-*/,
  /operational-studies:study\.studyCategories\..*/,
  /operational-studies:study\.studyStates\..*/,

  // Rolling stock
  /translation:rollingStock.categoriesOptions\..*/,
  /translation:rollingStock.curves\..*/,
  /translation:rollingStock.delete\..*/,
  /translation:rollingStock.errorMessages\..*/,
  /translation:rollingStock.electricalPowerStartupTime/,
  /translation:rollingStock.length/,
  /translation:rollingStock.mass/,
  /translation:rollingStock.maxSpeed/,
  /translation:rollingStock.messages\..*/,
  /translation:rollingStock.metadata\..*/,
  /translation:rollingStock.raisePantographTime/,
  /translation:rollingStock.unspecified/,

  // Simulation
  /operational-studies:simulationResults.departureTime/,
  /operational-studies:simulationResults.electricalProfiles\..*/,
  /operational-studies:simulationResults.powerRestriction\..*/,

  // Stdcm help section
  /stdcm-help-section:*/,

  // Stdcm
  /stdcm:consist\.errors\..*/,
  /stdcm:datetimeOutsideWindow/,
  /stdcm:departureDate/,
  /stdcm:linkedTrainDefaultCard\..*/,
  /stdcm:simulation.additionalResults/,
  /stdcm:simulation.calculatingSimulation/,
  /stdcm:simulation\.results\..*Conflict*/,
  /stdcm:stdcmErrors\..*/,
  /stdcm:trainPath.asSoonAsPossible/,
  /stdcm:trainPath\.linkedTrain\..*/,
  /stdcm:trainPath.preciseTime/,
  /stdcm:trainPath.respectDestinationSchedule/,
  /stdcm:trainPath\.stopType\..*/,
];

/**
 * Read a file and returns its content as a JSON
 */
async function readJsonFile<T extends { [key: string]: unknown }>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (e) {
    console.error(`Problem occured while reading ${filePath}`);
    throw e;
  }
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
          (key: string) => `${namespace}:${key.replace(/_(zero|one|other|many)$/, '')}`
        );
      })
    )
  )
    .flat()
    .sort();
  return new Set(allKeys);
}

/**
 * An i18n syntax error, with file and line position.
 */
class I18nSyntaxError extends Error {
  constructor(file: ts.SourceFile, node: ts.Node, msg: string) {
    const pos = file.getLineAndCharacterOfPosition(node.pos);
    super(`${file.fileName}:${pos.line + 1}: ${msg}`);
  }
}

/**
 * Check whether a function call invokes a translation function, record the
 * translation key if so.
 */
function visitCallExpression(
  checker: ts.TypeChecker,
  extractedKeys: Set<string>,
  file: ts.SourceFile,
  node: ts.CallExpression
) {
  const symbol = checker.getSymbolAtLocation(node.expression);
  if (!symbol) {
    return;
  }

  // Check whether a TFunction is being called
  const type = checker.getTypeOfSymbolAtLocation(symbol, node.expression);
  if (type.symbol?.escapedName !== 'TFunction') {
    return;
  }
  const typeArgs = checker.getTypeArguments(type as ts.TypeReference);

  // TFunction has two generic type arguments: namespace and key prefix
  if (typeArgs.length !== 2) {
    throw new I18nSyntaxError(file, node, 'expected two generic type arguments for TFunction');
  }
  if (node.arguments.length < 1) {
    throw new I18nSyntaxError(file, node, 'expected at least one argument for TFunction');
  }

  const namespaceType = typeArgs[0];
  const prefixType = typeArgs[1];

  // Extract the default namespace from the first generic type argument
  let defaultNamespace;
  if (namespaceType.isStringLiteral()) {
    defaultNamespace = namespaceType.value;
  } else if (checker.isTupleType(namespaceType)) {
    const namespaceTypeArgs = checker.getTypeArguments(namespaceType as ts.TypeReference);
    if (!namespaceTypeArgs[0].isStringLiteral()) {
      return;
    }
    defaultNamespace = namespaceTypeArgs[0].value;
  } else {
    return;
  }

  // Extract the key prefix from the second generic type argument
  let prefix;
  if (prefixType.isStringLiteral()) {
    prefix = prefixType.value;
  } else if (prefixType === checker.getUndefinedType()) {
    prefix = null;
  } else {
    return;
  }

  // TFunction has between 1 and 3 function arguments: key, default value, and
  // options
  if (node.arguments.length < 1 || node.arguments.length > 3) {
    throw new I18nSyntaxError(
      file,
      node,
      'expected between 1 and 3 function arguments for TFunction'
    );
  }

  const keyNode = node.arguments[0];
  const optionsNode = node.arguments.length > 1 ? node.arguments.at(-1) : undefined;

  // Extract the key from the first function argument
  if (!ts.isStringLiteral(keyNode)) {
    return;
  }
  let key = keyNode.text;

  // Extract the default namespace from the options in the last function
  // argument
  if (optionsNode && ts.isObjectLiteralExpression(optionsNode)) {
    const optionsType = checker.getTypeAtLocation(optionsNode);
    const nsSymbol = optionsType.symbol.members?.get(ts.escapeLeadingUnderscores('ns'));
    if (
      nsSymbol &&
      nsSymbol.valueDeclaration &&
      ts.isPropertyAssignment(nsSymbol.valueDeclaration) &&
      ts.isStringLiteral(nsSymbol.valueDeclaration.initializer)
    ) {
      defaultNamespace = nsSymbol.valueDeclaration.initializer.text;
    }
  }

  // If the key doesn't include a namespace, use the default one from options
  // or generic type arguments
  if (!key.includes(':')) {
    if (prefix) {
      key = `${prefix}.${key}`;
    }
    key = `${defaultNamespace}:${key}`;
  }

  // Trim plural suffixes from the key
  extractedKeys.add(key.replace(/_(zero|one|other|many)$/, ''));
}

/**
 * Recursively collect translation function calls inside a TypeScript AST node.
 */
function visitNode(
  checker: ts.TypeChecker,
  extractedKeys: Set<string>,
  file: ts.SourceFile,
  node: ts.Node
) {
  if (ts.isCallExpression(node)) {
    visitCallExpression(checker, extractedKeys, file, node);
  }

  node.forEachChild((child) => visitNode(checker, extractedKeys, file, child));
}

/**
 * Obtain an abstract syntax tree (AST) from the TypeScript compiler, look at
 * all translation function calls, and record a list of translation keys.
 */
function extractKeysFromTypeScript() {
  const tsconfigPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
  if (!tsconfigPath) {
    throw new Error('Failed to find tsconfig.json');
  }
  const tsconfigFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const tsconfig = ts.parseJsonConfigFileContent(
    tsconfigFile.config,
    ts.sys,
    path.dirname(tsconfigPath)
  );

  const program = ts.createProgram({
    options: tsconfig.options,
    rootNames: tsconfig.fileNames,
    projectReferences: tsconfig.projectReferences,
  });
  const checker = program.getTypeChecker();

  const files = program.getSourceFiles();
  const extractedKeys = new Set<string>();
  for (const file of files) {
    visitNode(checker, extractedKeys, file, file);
  }

  return extractedKeys;
}

const keysByLocale = await Promise.all(
  LANGUAGES.map(async (locale) => {
    const keys = await getLocalesKeys(`${process.cwd()}/public/locales`, locale);
    return { locale, keys };
  })
);

const extractedKeys = extractKeysFromTypeScript();

const unusedKeys: string[] = [];
keysByLocale.forEach(({ locale, keys }) => {
  keys.forEach((key) => {
    if (!extractedKeys.has(key) && IGNORE_UNUSED.every((pattern) => !key.match(pattern))) {
      unusedKeys.push(`${locale}:${key}`);
    }
  });
});

const missingKeys: string[] = [];
extractedKeys.forEach((key) => {
  if (IGNORE_MISSING.every((pattern) => !key.match(pattern))) {
    keysByLocale.forEach(({ locale, keys }) => {
      if (!keys.has(key)) {
        missingKeys.push(`${locale}:${key}`);
      }
    });
  }
});

if (unusedKeys.length > 0) {
  console.warn(`Unused keys (${unusedKeys.length})`);
  console.warn('----------------------------------');
  console.warn(unusedKeys.join('\n'));
  console.warn();
}

if (missingKeys.length > 0) {
  console.warn(`Missing keys (${missingKeys.length})`);
  console.warn('------------------------------------');
  console.warn(missingKeys.join('\n'));
  console.warn();
  console.warn(`/!\\ Failed: missing keys are not allowed in ${LANGUAGES}`);
}

if (unusedKeys.length > 0 || missingKeys.length > 0) {
  process.exit(1);
}
