import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import type { Grant, Privilege } from 'common/authorization/types';
import generateGrantSelectProps from 'common/authorization/utils/generateGrantSelectProps';

const GRANTS = {
  READER: ['can_read', 'can_share_read'],
  WRITER: ['can_read', 'can_share_read', 'can_write', 'can_share_write'],
  OWNER: [
    'can_read',
    'can_share_read',
    'can_write',
    'can_share_write',
    'can_delete',
    'can_share_ownership',
  ],
} as Record<Grant, Privilege[]>;

describe('generateSelectPropsForGrant', () => {
  const t = ((key: string) => key) as TFunction;

  it('should return all allowed options if user privileges are sufficient', () => {
    const result = generateGrantSelectProps({
      subjectGrant: 'READER',
      userPrivileges: new Set(GRANTS.OWNER),
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
      subjectGrant: 'READER',
      userPrivileges: new Set(GRANTS.WRITER),
      t,
    });

    expect(result).toEqual({
      value: { label: 'authorization.grants.read', value: 'READER' },
      options: [
        { label: 'authorization.grants.read', value: 'READER' },
        { label: 'authorization.grants.edit', value: 'WRITER' },
      ],
      readOnly: false,
    });
  });

  it("should return readOnly with only the subject grant if the connected user cannot downgrade subject's grant", () => {
    const result = generateGrantSelectProps({
      subjectGrant: 'WRITER',
      userPrivileges: new Set(GRANTS.READER),
      t,
    });

    expect(result).toEqual({
      value: { label: 'authorization.grants.edit', value: 'WRITER' },
      options: [{ label: 'authorization.grants.edit', value: 'WRITER' }],
      readOnly: true,
    });
  });
});
