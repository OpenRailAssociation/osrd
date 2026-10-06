import { Link } from "react-router-dom";
import useAuth from "utils/hooks/useAuth";

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

export default function AdminDashboard() {
  return (
    <>
      <Header />
      <main>
        Admin dashboard in progress, come back later! :)
        <br />
        <Link to="/">
          <a role="button" href="/">
            Back to main page
          </a>
        </Link>
      </main>
    </>
  );
}
