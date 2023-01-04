import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';

export default function Study() {
  return (
    <>
      <NavBarSNCF appName="Study" logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        Coucou étude, liste des scénarios
      </main>
    </>
  );
}
