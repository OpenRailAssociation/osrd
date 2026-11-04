import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { Role } from 'common/api/osrdEditoastApi';

import './styles/user-list-table.css';

type UserInfo = {
  id: number;
  name: string;
  identities: string[];
  groups: string[];
  roles: Role[];
};

function RoleTag({ userRole }: { userRole: Role }) {
  const { t } = useTranslation('admin-dashboard');
  const text = t(`roles.${userRole}`, { defaultValue: 'unknown' });
  return <li data-role={userRole}>{text}</li>;
}

function Row({ name, identities, groups, roles }: UserInfo) {
  return (
    <tr>
      <td>{name}</td>
      <td>
        <ul>
          {identities.map((identity, index) => (
            <li key={index}>{identity}</li>
          ))}
        </ul>
      </td>
      <td>
        <ul>
          {groups.map((group, index) => (
            <li key={index}>{group}</li>
          ))}
        </ul>
      </td>
      <td>
        <ul>
          {roles.map((role, index) => (
            <RoleTag key={index} userRole={role} />
          ))}
        </ul>
      </td>
    </tr>
  );
}

export function UserListTable() {
  const { t } = useTranslation('admin-dashboard');
  const users: UserInfo[] = [
    {
      id: 1,
      name: 'Alice',
      identities: ['SNCF2/ABC12345', 'ABCDEF/34567890Y65R4', 'IUHJUH/OIU'],
      groups: ['SNCF RESEAU', 'DEV'],
      roles: ['Admin', 'Stdcm', 'OperationalStudies'],
    },
    {
      id: 2,
      name: 'Bob',
      identities: ['SNCF2/XYZ98765', 'XYZABC/0987654321'],
      groups: ['DB CARGO FRANCE'],
      roles: ['Stdcm'],
    },
    {
      id: 3,
      name: 'Charlie',
      identities: ['SNCF2/LMN45678'],
      groups: ['SNCF RESEAU'],
      roles: ['OperationalStudies'],
    },
  ];
  return (
    <table className="user-list-table">
      <caption>
        <div className="user-list-header">
          <p className="user-count">{t('users', { count: 4 })}</p>
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
      {users.map((user) => (
        <Row key={user.id} {...user} />
      ))}
    </table>
  );
}
