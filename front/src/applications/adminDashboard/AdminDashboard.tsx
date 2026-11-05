import { Link } from 'react-router-dom';

import useAuth from 'utils/hooks/useAuth';

import { UserListTable } from './UserListTable';

import './styles/admin-dashboard.css';

function Header() {
  const { username } = useAuth();
  return (
    <header className="admin-dashboard-header">
      <Link to="/">
        <a role="button" href="/" className="osrd-brand-name">
          OSRD
        </a>
      </Link>
      <div className="header-tools">
        <button className="help-button">?</button>
        <p className="header-username">{username}</p>
      </div>
    </header>
  );
}

export default function AdminDashboard() {
  return (
    <div className="admin-dashboard">
      <Header />
      <main className="admin-dashboard-page">
        <div className="admin-user-list">
          <UserListTable />
        </div>
      </main>
    </div>
  );
}
