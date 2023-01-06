import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function BreadCrumbs() {
  const { t } = useTranslation('osrd/project');
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/osrd">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/osrd/project">Nom du projet</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      Nom de l&apos;étude
    </div>
  );
}

export default function Study() {
  return (
    <>
      <NavBarSNCF appName={<BreadCrumbs />} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        Coucou étude, liste des scénarios
      </main>
    </>
  );
}
