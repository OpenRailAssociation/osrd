import { useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import {
  osrdEditoastApi,
  type GetAuthzUsersApiResponse,
  type Role,
} from 'common/api/osrdEditoastApi';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import UserEditForm, { type UserEditFormState } from './UserEditForm';

import './styles/user-list-table.css';

const ROLE_ORDER: Record<Role, number> = { Admin: 0, Stdcm: 1, OperationalStudies: 2 };

function RoleTag({ userRole }: { userRole: Role }) {
  'use memo';
  const { t } = useTranslation('admin-dashboard');
  const text = t(`roles.${userRole}`, { defaultValue: 'unknown' });
  return (
    <li className="role-tag" data-role={userRole}>
      {text}
    </li>
  );
}

function Row({ name, identities, groups, effective_roles }: GetAuthzUsersApiResponse[number]) {
  'use memo';
  const sortedRoles = effective_roles.toSorted((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]);
  return (
    <tr className="user-row">
      <td>{name}</td>
      <td>
        <ul className="identities-list">
          {identities.map((identity) => (
            <li key={identity}>{identity}</li>
          ))}
        </ul>
      </td>
      <td className="groups-list">
        <ul>
          {groups.map(({ id, name: groupName }) => (
            <li key={id}>{groupName}</li>
          ))}
        </ul>
      </td>
      <td>
        <ul className="roles-list">
          {sortedRoles.map((role) => (
            <RoleTag key={role} userRole={role} />
          ))}
        </ul>
      </td>
    </tr>
  );
}

export function UserListTable() {
  'use memo';

  const { t } = useTranslation('admin-dashboard');
  const dispatch = useAppDispatch();
  const [createUser, { isLoading }] = osrdEditoastApi.endpoints.postAuthzUsers.useMutation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { data: users } = osrdEditoastApi.endpoints.getAuthzUsers.useQuery();
  const sortedUsers = users?.toSorted((a, b) => b.id - a.id);

  const saveUser = async ({ name, groups, roles, identities }: UserEditFormState) => {
    try {
      await createUser({
        body: {
          name,
          groups,
          roles,
          identities: identities.map(({ provider, identifier }) => `${provider}/${identifier}`),
        },
      }).unwrap();
      dispatch(
        setSuccess({
          title: t('userCreated'),
          text: t('userCreatedMessage', { name }),
        })
      );
      setIsFormOpen(false);
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };

  return (
    <table className="user-list-table">
      <caption>
        <div className="user-list-header">
          <p className="user-count">{t('users', { count: users?.length ?? 0 })}</p>
          {!isFormOpen && (
            <Button
              label={t('addUser')}
              size="small"
              variant="Quiet"
              onClick={() => setIsFormOpen(true)}
            />
          )}
          <Button
            className="user-edit-groups-button"
            label={t('editGroups')}
            size="small"
            variant="Quiet"
            onClick={() => {}}
          />
        </div>
      </caption>
      <tbody>
        {isFormOpen && (
          <UserEditForm
            initialState={{
              name: '',
              identities: [{ key: uuidv4(), identifier: '' }],
              roles: [],
              groups: [],
            }}
            onSubmit={saveUser}
            isLoading={isLoading}
            onCancel={() => setIsFormOpen(false)}
          />
        )}
        {sortedUsers?.map((user) => (
          <Row key={user.id} {...user} />
        ))}
      </tbody>
    </table>
  );
}
