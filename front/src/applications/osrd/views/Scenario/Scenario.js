import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/osrd.svg';

export default function Scenario() {
  return (
    <>
      <NavBarSNCF appName="Scenario" logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        Coucou Scénario
      </main>
    </>
  );
}
