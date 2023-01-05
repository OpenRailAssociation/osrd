import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';

export default function Project() {
  return (
    <>
      <NavBarSNCF appName="Etudes" logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        Coucou projet, liste des études
      </main>
    </>
  );
}
