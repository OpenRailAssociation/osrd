import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      Admin dashboard in progress, come back later! :)
      <Link to="/">
        <a role="button" href="/">
          Back to main page
        </a>
      </Link>
    </main>
  );
}
