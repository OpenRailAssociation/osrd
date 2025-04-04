import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import database from 'common/api/mock/mockData';
import generateGrantSelectProps from 'common/authorization/utils/generateGrantSelectProps';

describe('generateSelectPropsForGrant', () => {
  const t = ((key: string) => key) as TFunction;

  it('should return all allowed options if user privileges are sufficient', () => {
    const result = generateGrantSelectProps({
      privilegesByGrant: database.GRANTS,
      subjectGrant: 'READER',
      connectedUserGrant: 'OWNER',
      t,
    });

    expect(result).toEqual({
      value: { label: 'authorization.grants.read', value: 'READER' },
      options: [
        { label: 'authorization.grants.none', value: undefined },
        { label: 'authorization.grants.read', value: 'READER' },
        { label: 'authorization.grants.edit', value: 'WRITER' },
        { label: 'authorization.grants.full', value: 'OWNER' },
      ],
      readOnly: false,
    });
  });

  it('should exclude options where privileges are insufficient', () => {
    const result = generateGrantSelectProps({
      privilegesByGrant: database.GRANTS,
      subjectGrant: 'READER',
      connectedUserGrant: 'WRITER',
      t,
    });

    expect(result).toEqual({
      value: { label: 'authorization.grants.read', value: 'READER' },
      options: [
        { label: 'authorization.grants.none', value: undefined },
        { label: 'authorization.grants.read', value: 'READER' },
        { label: 'authorization.grants.edit', value: 'WRITER' },
      ],
      readOnly: false,
    });
  });

  it("should return readOnly with only the subject grant if the connected user cannot downgrade subject's grant", () => {
    const result = generateGrantSelectProps({
      privilegesByGrant: database.GRANTS,
      subjectGrant: 'WRITER',
      connectedUserGrant: 'READER',
      t,
    });

    expect(result).toEqual({
      value: { label: 'authorization.grants.edit', value: 'WRITER' },
      options: [{ label: 'authorization.grants.edit', value: 'WRITER' }],
      readOnly: true,
    });
  });
});
