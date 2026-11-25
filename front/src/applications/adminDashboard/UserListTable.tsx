import { useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
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

import UserEditForm, { type UserEditFormState, UserEditFormMode } from './UserEditForm';

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

function Row({
  name,
  identities,
  groups,
  effective_roles,
  clickable,
  onClick,
}: GetAuthzUsersApiResponse[number] & {
  clickable: boolean;
  onClick: () => void;
}) {
  'use memo';
  const sortedRoles = effective_roles.toSorted((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]);
  return (
    <tr
      className={cx('user-row', clickable && 'user-row-selectable')}
      onClick={() => clickable && onClick()}
    >
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
  const [createUser, { isLoading: isCreating }] =
    osrdEditoastApi.endpoints.postAuthzUsers.useMutation();
  const [updateUser, { isLoading: isUpdating }] =
    osrdEditoastApi.endpoints.patchAuthzUsersByUserId.useMutation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [initialFormState, setInitialFormState] = useState<UserEditFormState | null>(null);
  const { data: users } = osrdEditoastApi.endpoints.getAuthzUsers.useQuery();
  const sortedUsers = users?.toSorted((a, b) => b.id - a.id);

  const saveUser = async ({ name, groups, roles, identities }: UserEditFormState) => {
    const body = {
      name,
      groups,
      roles,
      identities: identities.map(({ provider, identifier }) => `${provider}/${identifier}`),
    };
    try {
      if (editingUserId !== null) {
        await updateUser({ userId: editingUserId, body }).unwrap();
        dispatch(
          setSuccess({
            title: t('userUpdated'),
            text: t('userUpdatedMessage', { name }),
          })
        );
      } else {
        await createUser({ body }).unwrap();
        dispatch(
          setSuccess({
            title: t('userCreated'),
            text: t('userCreatedMessage', { name }),
          })
        );
      }
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
              onClick={() => {
                setEditingUserId(null);
                setIsFormOpen(true);
                setInitialFormState({
                  mode: UserEditFormMode.Add,
                  name: '',
                  identities: [{ key: uuidv4(), provider: '', identifier: '' }],
                  roles: [],
                  groups: [],
                });
              }}
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
            initialState={initialFormState!}
            onSubmit={saveUser}
            onDelete={() => {}}
            isLoading={isCreating || isUpdating}
            onCancel={() => setIsFormOpen(false)}
          />
        )}
        {sortedUsers?.map((user) => (
          <Row
            key={user.id}
            {...user}
            clickable={!isFormOpen}
            onClick={() => {
              setEditingUserId(user.id);
              setIsFormOpen(true);
              setInitialFormState({
                mode: UserEditFormMode.Edit,
                name: user.name,
                identities: user.identities.map((identity) => ({
                  key: uuidv4(),
                  provider: identity.split('/', 2)[0],
                  // NOTE: identifiers theoretically can contain slashes
                  identifier: identity.split('/').slice(1).join('/'),
                })),
                roles: user.direct_roles,
                groups: user.groups.map(({ id }) => id),
              });
            }}
          />
        ))}
      </tbody>
    </table>
  );
}
