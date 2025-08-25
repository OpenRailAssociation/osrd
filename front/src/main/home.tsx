import { useTranslation } from 'react-i18next';

import editorImg from 'assets/pictures/home/editor.svg';
import mapImg from 'assets/pictures/home/map.svg';
import operationalStudiesImg from 'assets/pictures/home/operationalStudies.svg';
import rollingStockEditorImg from 'assets/pictures/home/rollingstockeditor.svg';
import stdcmImg from 'assets/pictures/home/stdcm.svg';
import useAllowedUserRoles from 'common/authorization/hooks/useAllowedUserRoles';
import CardSNCF from 'common/BootstrapSNCF/CardSNCF';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBar from 'common/NavBar';

export default function Home() {
  const { t } = useTranslation();
  const {
    operationalStudiesAllowed,
    stdcmAllowed,
    infraEditorAllowed,
    rollingStockEditorAllowed,
    mapAllowed,
  } = useAllowedUserRoles();

  return (
    <ModalProvider>
      <NavBar />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="cardscontainer">
          <div className="row justify-content-center mb-2">
            <div
              className="col-6 col-md-5 col-lg-4 col-xl-3"
              {...(!operationalStudiesAllowed && { 'aria-disabled': true })}
            >
              <CardSNCF
                img={operationalStudiesImg}
                title={t('operationalStudies')}
                link="/operational-studies/projects"
                data-testid="operationalStudies"
              />
            </div>

            <div
              className="col-6 col-md-5 col-lg-4 col-xl-3"
              {...(!stdcmAllowed && { 'aria-disabled': true })}
            >
              <CardSNCF img={stdcmImg} title={t('stdcm')} link="/stdcm" openInNewTab />
            </div>
          </div>
          <div className="row justify-content-center">
            <div className="col-12 col-md-10 col-lg-8 col-xl-6">
              <div className="row">
                <div
                  className="col-6 col-sm-4 mb-2"
                  {...(!infraEditorAllowed && { 'aria-disabled': true })}
                >
                  <CardSNCF img={editorImg} title={t('editor')} link="/editor" />
                </div>

                <div
                  className="col-6 col-sm-4 mb-2"
                  {...(!rollingStockEditorAllowed && { 'aria-disabled': true })}
                >
                  <CardSNCF
                    img={rollingStockEditorImg}
                    title={t('rollingStockEditor')}
                    link="/rolling-stock-editor"
                  />
                </div>

                <div
                  className="col-6 col-sm-4 mb-2"
                  {...(!mapAllowed && { 'aria-disabled': true })}
                >
                  <CardSNCF img={mapImg} title={t('map')} link="/map" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ModalProvider>
  );
}
