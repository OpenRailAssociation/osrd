import { act } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Role } from 'common/api/osrdEditoastApi';
import { updateAuthzUser } from 'reducers/user';
import { useAppDispatch } from 'store';

import useAllowedUserRoles from '../useAllowedUserRoles';

describe('useAllowedUserRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const exampleUserId = 44;

  const cases: {
    caseName: string;
    userRoles: Role[];
    expectedAllowedViews: {
      operationalStudiesAllowed: boolean;
      stdcmAllowed: boolean;
      infraEditorAllowed: boolean;
      rollingStockEditorAllowed: boolean;
      mapAllowed: boolean;
    };
  }[] = [
    {
      caseName: 'stdcm users',
      userRoles: ['Stdcm'],
      expectedAllowedViews: {
        operationalStudiesAllowed: false,
        stdcmAllowed: true,
        infraEditorAllowed: false,
        rollingStockEditorAllowed: false,
        mapAllowed: true,
      },
    },
    {
      caseName: 'operational studies users',
      userRoles: ['OperationalStudies'],
      expectedAllowedViews: {
        operationalStudiesAllowed: true,
        stdcmAllowed: false,
        infraEditorAllowed: true,
        rollingStockEditorAllowed: true,
        mapAllowed: true,
      },
    },
    {
      caseName: 'users with multiple roles',
      userRoles: ['OperationalStudies', 'Stdcm'],
      expectedAllowedViews: {
        operationalStudiesAllowed: true,
        stdcmAllowed: true,
        infraEditorAllowed: true,
        rollingStockEditorAllowed: true,
        mapAllowed: true,
      },
    },
    {
      caseName: 'super users',
      userRoles: ['Admin'],
      expectedAllowedViews: {
        operationalStudiesAllowed: true,
        stdcmAllowed: true,
        infraEditorAllowed: true,
        rollingStockEditorAllowed: true,
        mapAllowed: true,
      },
    },
    {
      caseName: 'users with no roles',
      userRoles: [],
      expectedAllowedViews: {
        operationalStudiesAllowed: false,
        stdcmAllowed: false,
        infraEditorAllowed: false,
        rollingStockEditorAllowed: false,
        mapAllowed: false,
      },
    },
  ];

  it.each(cases)(
    'should allow expected views for $caseName',
    ({ userRoles, expectedAllowedViews: expected }) => {
      const { result } = renderHookWithStore(() => ({
        allowedUserRoles: useAllowedUserRoles(),
        dispatch: useAppDispatch(),
      }));

      act(() => {
        result.current.dispatch(
          updateAuthzUser({
            userRoles,
            userId: exampleUserId,
          })
        );
      });

      expect(result.current.allowedUserRoles).toEqual(expected);
    }
  );

  it('should allow no views when no user is provided', () => {
    const { result } = renderHookWithStore(() => ({
      allowedUserRoles: useAllowedUserRoles(),
      dispatch: useAppDispatch(),
    }));

    expect(result.current.allowedUserRoles).toEqual({
      operationalStudiesAllowed: false,
      stdcmAllowed: false,
      infraEditorAllowed: false,
      rollingStockEditorAllowed: false,
      mapAllowed: false,
    });
  });
});
