import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/projects.svg';

export default function HomeContent() {
  return (
    <>
      <NavBarSNCF appName="Projects" logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        Coucou HomeContent, liste des projets
      </main>
    </>
  );
}
