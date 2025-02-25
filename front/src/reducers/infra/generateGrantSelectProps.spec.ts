import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import database from 'common/api/mock/mockData';
import generateGrantSelectProps from 'modules/infra/utils/generateGrantSelectProps';

describe('generateSelectPropsForGrant', () => {
  const t = ((key: string) => key) as TFunction;

  it('should return all allowed options if user privileges are sufficient', () => {
    const result = generateGrantSelectProps({
      resourceGrants: database.GRANTS,
      subjectGrant: 'READER',
      connectedUserGrant: 'OWNER',
      t,
    });

    expect(result).toEqual({
      value: { label: 'grants.read', value: 'READER' },
      options: [
        { label: 'grants.none', value: 'NONE' },
        { label: 'grants.read', value: 'READER' },
        { label: 'grants.edit', value: 'WRITER' },
        { label: 'grants.full', value: 'OWNER' },
      ],
      disabled: false,
    });
  });

  it('should exclude options where privileges are insufficient', () => {
    const result = generateGrantSelectProps({
      resourceGrants: database.GRANTS,
      subjectGrant: 'READER',
      connectedUserGrant: 'WRITER',
      t,
    });

    expect(result).toEqual({
      value: { label: 'grants.read', value: 'READER' },
      options: [
        { label: 'grants.none', value: 'NONE' },
        { label: 'grants.read', value: 'READER' },
        { label: 'grants.edit', value: 'WRITER' },
      ],
      disabled: false,
    });
  });

  it("should return disabled with only the subject grant if the connected user cannot downgrade subject's grant", () => {
    const result = generateGrantSelectProps({
      resourceGrants: database.GRANTS,
      subjectGrant: 'WRITER',
      connectedUserGrant: 'READER',
      t,
    });

    expect(result).toEqual({
      value: { label: 'grants.edit', value: 'WRITER' },
      options: [{ label: 'grants.edit', value: 'WRITER' }],
      disabled: true,
    });
  });
});
