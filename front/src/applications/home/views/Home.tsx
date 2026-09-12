import type { ImgHTMLAttributes } from 'react';

import { useTranslation } from 'react-i18next';
import { Link, type LinkProps } from 'react-router-dom';

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

type AppLinkProps = LinkProps & {
  cardImage: ImgHTMLAttributes<HTMLImageElement>['src'];
  allowed?: boolean;
};

function AppLink({ allowed, children, cardImage, ...linkProps }: AppLinkProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'home' });

  return (
    <Link {...linkProps} aria-disabled={!allowed || undefined}>
      <div className="app-card">
        <img src={cardImage} alt="" />
        {!allowed && <div className="not-authorized-warning">{t('not-authorized-warning')}</div>}
      </div>
      <div className="app-label" data-testid="page-title">
        {children}
      </div>
    </Link>
  );
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
          <AppLink
            to="/operational-studies/projects"
            className="app-link app-link-opstd"
            data-testid="operationalStudies"
            cardImage={operationalStudiesImg}
            allowed={operationalStudiesAllowed}
          >
            {t('applications.operational-studies')}
          </AppLink>

          <AppLink
            to="/editor"
            className="app-link app-link-editor"
            cardImage={editorImg}
            allowed={infraEditorAllowed}
          >
            {t('applications.infrastructures-editor')}
          </AppLink>

          <AppLink
            to="/rolling-stock-editor"
            className="app-link app-link-rolling-stocks-editor"
            allowed={rollingStockEditorAllowed}
            cardImage={rollingStockEditorImg}
          >
            {t('applications.rolling-stocks-editor')}
          </AppLink>

          <AppLink
            to="/map"
            className="app-link app-link-reference-map"
            allowed={mapAllowed}
            cardImage={mapImg}
          >
            {t('applications.reference-map')}
          </AppLink>

          <AppLink
            to="/stdcm"
            className="app-link app-link-stdcm"
            target="_blank"
            allowed={stdcmAllowed}
            cardImage={stdcmImg}
          >
            {t('applications.stdcm')}
          </AppLink>
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
