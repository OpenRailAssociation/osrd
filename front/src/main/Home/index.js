import './Home.scss';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import React from 'react';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import osrdLogo from 'assets/pictures/osrd.png';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MdMoreTime, MdOutlineRailwayAlert, MdOutlineTimeline, MdShowChart } from 'react-icons/md';
import { FaMap, FaMapMarked } from 'react-icons/fa';

export default function Home() {
  const user = useSelector((state) => state.user);
  const { t } = useTranslation('home');

  return (
    <>
      <NavBarSNCF appName="OSRD" username={user.username} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="">
          <div className="my-4 d-flex align-items-center justify-content-center">
            <img src={osrdLogo} alt="OSRD logo" width="92px" />
            <h1 className="font-weight-bold">Open Source Railway Designer</h1>
          </div>
          <div className="my-4 d-flex align-items-center justify-content-center">
            <div className="">
              <Link to="/osrd">
                <div className="title-page-link">
                  <MdShowChart />
                  <span className="ml-2">{t('timetable')}</span>
                </div>
              </Link>
              <Link to="/carto">
                <div className="title-page-link">
                  <FaMap />
                  <span className="ml-2">{t('map')}</span>
                </div>
              </Link>
              <Link to="/editor">
                <div className="title-page-link">
                  <FaMapMarked />
                  <span className="ml-2">{t('editor')}</span>
                </div>
              </Link>
              <Link to="/stdcm">
                <div className="title-page-link">
                  <MdOutlineRailwayAlert />
                  <span className="ml-2">{t('stdcm')}</span>
                </div>
              </Link>
              <Link to="/opendata">
                <div className="title-page-link">
                  <MdMoreTime />
                  <span className="ml-2">{t('opendataimport')}</span>
                </div>
              </Link>
              <Link to="/customget">
                <div className="title-page-link">
                  <MdOutlineTimeline />
                  <span className="ml-2">{t('customget')}</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
