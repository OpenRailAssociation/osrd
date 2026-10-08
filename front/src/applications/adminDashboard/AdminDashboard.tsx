import { Button } from "@osrd-project/ui-core";
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

function Table() {
  return (
    <div>
      <table id="adm-dash-user-table">
        <caption>
          <div>
            3 users
            <Button
              label="Add"
              size="small"
              variant="Quiet"
              onClick={() => {}}
            />
            <Button
              label="Edit groups"
              size="small"
              variant="Quiet"
              onClick={() => {}}
            />
          </div>
        </caption>
        <tr>
          <td>Alice</td>
          <td>
            <ul>
              <li>SNCF2/ABC12345</li>
              <li>ABCDEF/34567890Y65R4</li>
              <li>IUHJUH/OIU</li>
            </ul>
          </td>
          <td>
            <ul>
              <li>DEV</li>
              <li>DB CARGO FRANCE</li>
            </ul>
          </td>
          <td>
            <ul>
              <li>Admin</li>
              <li>ST DCM</li>
              <li>Operational Studies</li>
            </ul>
          </td>
        </tr>
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div style={{ backgroundColor: "rgba(235, 235, 234, 1)" }}>
      <Header />
      <main>
        <Table />
      </main>
    </div>
  );
}
