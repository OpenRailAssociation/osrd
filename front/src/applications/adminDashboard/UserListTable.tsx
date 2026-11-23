import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type GetAuthzUsersApiResponse,
  type Role,
} from 'common/api/osrdEditoastApi';

import './styles/user-list-table.css';

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
          {effective_roles.map((role) => (
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
  const { data: users } = osrdEditoastApi.endpoints.getAuthzUsers.useQuery();
  const sortedUsers = users?.toSorted((a, b) => b.id - a.id);
  return (
    <table className="user-list-table">
      <caption>
        <div className="user-list-header">
          <p className="user-count">{t('users', { count: users?.length ?? 0 })}</p>
          <Button label={t('addUser')} size="small" variant="Quiet" onClick={() => {}} />
          <Button
            className="user-edit-groups-button"
            label={t('editGroups')}
            size="small"
            variant="Quiet"
            onClick={() => {}}
          />
        </div>
      </caption>
      {sortedUsers?.map((user) => (
        <Row key={user.id} {...user} />
      ))}
    </table>
  );
}
