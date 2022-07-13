import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import Card from 'common/BootstrapSNCF/CardSNCF/CardSNCF';
import osrdLogo from 'assets/pictures/osrd.png';
import timetablePic from 'assets/pictures/timetable.png';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import cartoPic from 'assets/pictures/carto.png';
import editorPic from 'assets/pictures/editor.png';
import './Home.css';

export default function Home() {
  const user = useSelector((state) => state.user);
  const { t } = useTranslation();

  return (
    <>
      <NavBarSNCF appName="OSRD" username={user.username} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="mt-3 d-flex align-items-center justify-content-center">
          <img src={osrdLogo} alt="OSRD logo" width="128px" />
          <h1>Open-Source Railway Designer</h1>
        </div>
        <div className="cardscontainer">
          <div className="row">
            <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
              <Card img={timetablePic} title={t('Home.timetable')} link="/osrd" />
            </div>
            <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
              <Card img={cartoPic} title={t('Home.map')} link="/carto" />
            </div>
            <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
              <Card img={editorPic} title={t('Home.editor')} link="/editor" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
