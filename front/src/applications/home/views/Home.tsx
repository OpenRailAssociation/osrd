import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import editorImg from 'assets/pictures/home/editor.svg';
import mapImg from 'assets/pictures/home/map.png';
import operationalStudiesImg from 'assets/pictures/home/operationalStudies.svg';
import osrdLogoImg from 'assets/pictures/home/osrd-logo.svg';
import rollingStockEditorImg from 'assets/pictures/home/rollingstockeditor.svg';
import stdcmImg from 'assets/pictures/home/stdcm.svg';
import useAllowedUserRoles from 'common/authorization/hooks/useAllowedUserRoles';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBar from 'common/NavBar';
import ReleaseInformation from 'common/NavBar/ReleaseInformation';

import './home.css';

function AboutLink() {
  const { t } = useTranslation('translation', { keyPrefix: 'home' });
  const { openModal } = useModal();

  const openReleaseInformationModal = () => openModal(<ReleaseInformation />, 'lg');

  return (
    <button className="about-link" onClick={openReleaseInformationModal}>
      {t('about')}
    </button>
  );
}

function NotAuthorizedWarning() {
  const { t } = useTranslation('translation', { keyPrefix: 'home' });

  return <div className="not-authorized-warning">{t('not-authorized-warning')}</div>;
}

export default function Home() {
  const { t } = useTranslation('translation', { keyPrefix: 'home' });
  const {
    infraEditorAllowed,
    mapAllowed,
    operationalStudiesAllowed,
    rollingStockEditorAllowed,
    stdcmAllowed,
  } = useAllowedUserRoles();

  return (
    <ModalProvider>
      <main className="home-screen">
        <NavBar />

        <div className="apps-selector">
          <Link
            to="/operational-studies/projects"
            className="app-link app-link-opstd"
            data-testid="operationalStudies"
            aria-disabled={!operationalStudiesAllowed || undefined}
          >
            <div className="app-card">
              <img src={operationalStudiesImg} alt="" />
              {!operationalStudiesAllowed && <NotAuthorizedWarning />}
            </div>
            <div className="app-label">{t('applications.operational-studies')}</div>
          </Link>

          <Link
            to="/editor"
            className="app-link app-link-editor"
            aria-disabled={!infraEditorAllowed || undefined}
          >
            <div className="app-card">
              <img src={editorImg} alt="" />
              {!infraEditorAllowed && <NotAuthorizedWarning />}
            </div>
            <div className="app-label">{t('applications.infrastructures-editor')}</div>
          </Link>

          <Link
            to="/rolling-stock-editor"
            className="app-link app-link-rolling-stocks-editor"
            aria-disabled={!rollingStockEditorAllowed || undefined}
          >
            <div className="app-card">
              <img src={rollingStockEditorImg} alt="" />
              {!rollingStockEditorAllowed && <NotAuthorizedWarning />}
            </div>
            <div className="app-label">{t('applications.rolling-stocks-editor')}</div>
          </Link>

          <Link
            to="/map"
            className="app-link app-link-reference-map"
            aria-disabled={!mapAllowed || undefined}
          >
            <div className="app-card">
              <img src={mapImg} alt="" />
              {!mapAllowed && <NotAuthorizedWarning />}
            </div>
            <div className="app-label">{t('applications.reference-map')}</div>
          </Link>

          <Link
            to="/stdcm"
            className="app-link app-link-stdcm"
            target="_blank"
            aria-disabled={!stdcmAllowed || undefined}
          >
            <div className="app-card">
              <img src={stdcmImg} alt="" />
              {!stdcmAllowed && <NotAuthorizedWarning />}
            </div>
            <div className="app-label">{t('applications.stdcm')}</div>
          </Link>
        </div>

        <div className="osrd-branding">
          <img src={osrdLogoImg} alt="OSRD" className="osrd-home-logo" />
          <div className="osrd-brand">Open Source Railway Designer</div>
        </div>

        <AboutLink />
      </main>
    </ModalProvider>
  );
}
