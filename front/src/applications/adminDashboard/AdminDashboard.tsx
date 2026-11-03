import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { Role } from 'common/api/osrdEditoastApi';
import useAuth from 'utils/hooks/useAuth';

function Header() {
  const { username } = useAuth();
  return (
    <header id="adm-dash-header">
      <Link to="/">
        <a role="button" href="/" id="osrd">
          OSRD
        </a>
      </Link>
      <button id="help">?</button>
      <p id="username">{username}</p>
    </header>
  );
}

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

function Table() {
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
    <div>
      <table id="adm-dash-user-table">
        <caption>
          <div>
            <p id="user-count">{t('users', { count: 4 })}</p>
            <Button label={t('addUser')} size="small" variant="Quiet" onClick={() => {}} />
            <Button label={t('editGroups')} size="small" variant="Quiet" onClick={() => {}} />
          </div>
        </caption>
        {users.map((user) => (
          <Row key={user.id} {...user} />
        ))}
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div>
      <Header />
      <main>
        <Table />
      </main>
    </div>
  );
}
