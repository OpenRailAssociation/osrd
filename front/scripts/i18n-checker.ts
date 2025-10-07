import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'glob';
import { jsonKeyPathList } from 'json-key-path-list';
import * as ts from 'typescript';

const LANGUAGES = ['en', 'fr'];

const IGNORE_MISSING: RegExp[] = [
  /stdcm-help-section:asu/,
  /stdcm-help-section:externalSupport/,
  /stdcm-help-section:sections/,
  /stdcm:stdcmErrors\..*/,
  /translation:Editor.obj-types.NeutralSection/,
  /translation:Editor.obj-types.SwitchType/,
  /translation:Editor.obj-types.OperationalPoint/,
];

const IGNORE_UNUSED: RegExp[] = [
  /errors:.*/, // Errors are generated and used dynamicly
  /infraEditor:.*/, // Translation of properties object for the form
  /translation:Editor\.tools\..*/, // Editor tool's label are generated
  /translation:Editor.layers\..*/,
  /Editor\.item-statuses\..*/,
  /translation:Editor\.infra-errors\.error-type\..*/, // Infra error types are generated

  // Manage timetable item
  /operational-studies:manageTimetableItem.errorMessages\..*/,
  /operational-studies:manageTimetableItem.pathfindingErrors\.pathfinding_failure/,

  // Project
  /operational-studies:main\.pacedTrain/,
  /operational-studies:main\.pacedTrainCount/,
  /operational-studies:main\.timetable\.invalid\.pathfinding_not_found/,
  /operational-studies:main\.train/,
  /operational-studies:main\.trainCount/,

  // Rolling stock
  /translation:rollingStock.curves\..*/,
  /translation:rollingStock.errorMessages\..*/,
  /translation:rollingStock.messages\..*/,
  /translation:rollingStock.metadata\..*/,

  // Simulation
  /operational-studies:simulationResults.departureTime/,
  /operational-studies:simulationResults.electricalProfiles\..*/,
  /operational-studies:simulationResults.powerRestriction\..*/,

  // Stdcm help section
  /stdcm-help-section:*/,

  // Stdcm
  /stdcm:consist\.errors\..*/,
  /stdcm:stdcmErrors\..*/,
];

/**
 * Read a file and returns its content as a JSON
 */
async function readJsonFile<T extends { [key: string]: unknown }>(filePath: string): Promise<T> {
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (e) {
    console.error(`Problem occurred while reading ${filePath}`);
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

type KeyMetadata = {
  // Filename and line number the extracted translation key comes from
  sourceFilename: string;
  sourceLine: number;
};

/**
 * Check whether a function call invokes a translation function, record the
 * translation key if so.
 */
function visitCallExpression(
  checker: ts.TypeChecker,
  extractedKeys: Map<string, KeyMetadata>,
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

  // Extract key(s) from the first function argument
  let keys;
  if (ts.isStringLiteral(keyNode) || ts.isNoSubstitutionTemplateLiteral(keyNode)) {
    keys = [keyNode.text];
  } else {
    const keyType = checker.getTypeAtLocation(keyNode);
    if (!keyType.isUnion()) {
      return;
    }

    keys = [];
    for (const t of keyType.types) {
      if (!t.isStringLiteral()) {
        return;
      }
      keys.push(t.value);
    }
  }

  // Extract the default namespace and key prefix from the options in the last
  // function argument
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

    // The key prefix option is only valid if getFixedT() was called with a
    // prefix
    const keyPrefixSymbol = optionsType.symbol.members?.get(
      ts.escapeLeadingUnderscores('keyPrefix')
    );
    if (
      prefix &&
      keyPrefixSymbol &&
      keyPrefixSymbol.valueDeclaration &&
      ts.isPropertyAssignment(keyPrefixSymbol.valueDeclaration) &&
      ts.isStringLiteral(keyPrefixSymbol.valueDeclaration.initializer)
    ) {
      prefix = keyPrefixSymbol.valueDeclaration.initializer.text;
    }
  }

  const pos = file.getLineAndCharacterOfPosition(node.pos);
  for (let key of keys) {
    // If the key doesn't include a namespace, use the default one from options
    // or generic type arguments
    if (!key.includes(':')) {
      if (prefix) {
        key = `${prefix}.${key}`;
      }
      key = `${defaultNamespace}:${key}`;
    }

    extractedKeys.set(key, {
      sourceFilename: file.fileName,
      sourceLine: pos.line + 1,
    });
  }
}

/**
 * Recursively collect translation function calls inside a TypeScript AST node.
 */
function visitNode(
  checker: ts.TypeChecker,
  extractedKeys: Map<string, KeyMetadata>,
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
  const extractedKeys = new Map<string, KeyMetadata>();
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
for (const [key, metadata] of extractedKeys) {
  if (IGNORE_MISSING.every((pattern) => !key.match(pattern))) {
    keysByLocale.forEach(({ locale, keys }) => {
      if (!keys.has(key)) {
        missingKeys.push(`${locale}:${key} (${metadata.sourceFilename}:${metadata.sourceLine})`);
      }
    });
  }
}

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
