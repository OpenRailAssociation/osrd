import { toUpper } from 'utils/strings';

export const tokenClause = (token: string) => [
  'or',
  ['=', ['main_code'], toUpper(token)],
  ['search', ['name'], token],
  ['search', ['main_code'], token],
  ['search', ['secondary_code'], token],
];

export const buildMultiTokenQuery = (tokens: string[]) => ['and', ...tokens.map(tokenClause)];

export const searchQuery = (debouncedTrimmedInput: string) => [
  'or',
  ['search', ['name'], debouncedTrimmedInput],
  ['search', ['main_code'], debouncedTrimmedInput],
  ['search', ['secondary_code'], debouncedTrimmedInput],
];

export const largePayload = (infraId: number | undefined, debouncedTrimmedInput: string) => ({
  object: 'operationalpoint',
  query: [
    'and',
    searchQuery(debouncedTrimmedInput),
    infraId !== undefined ? ['=', ['infra_id'], infraId] : true,
  ],
});

export const exactTrigramPayload = (infraId: number | undefined, firstTokenUpper: string) => ({
  object: 'operationalpoint',
  query: [
    'and',
    ['=', ['main_code'], firstTokenUpper],
    infraId !== undefined ? ['=', ['infra_id'], infraId] : true,
  ],
});

export const multiPayloadFromTokens = (infraId: number | undefined, tokens: string[]) => {
  const multiQuery = buildMultiTokenQuery(tokens);
  return {
    object: 'operationalpoint',
    query: ['and', multiQuery, infraId !== undefined ? ['=', ['infra_id'], infraId] : true],
  };
};
