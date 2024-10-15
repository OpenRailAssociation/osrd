import { useTranslation } from 'react-i18next';

import editorImg from 'assets/pictures/home/editor.svg';
import mapImg from 'assets/pictures/home/map.svg';
import operationalStudiesImg from 'assets/pictures/home/operationalStudies.svg';
import rollingStockEditorImg from 'assets/pictures/home/rollingstockeditor.svg';
import stdcmImg from 'assets/pictures/home/stdcm.svg';
import RoleBasedContent from 'common/authorization/components/RoleBasedContent';
import { REQUIRED_USER_ROLES_FOR } from 'common/authorization/roleBaseAccessControl';
import Card from 'common/BootstrapSNCF/CardSNCF/CardSNCF';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { getOsrdLogo } from 'utils/logo';

export default function Home() {
  const { t } = useTranslation('home/home');

  return (
    <ModalProvider>
      <NavBarSNCF logo={getOsrdLogo()} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="cardscontainer">
          <div className="row justify-content-center mb-2">
            <RoleBasedContent
              requiredRoles={REQUIRED_USER_ROLES_FOR.VIEWS.OPERATIONAL_STUDIES}
              disableIfUnauthorized
            >
              <div className="col-6 col-md-5 col-lg-4 col-xl-3">
                <Card
                  img={operationalStudiesImg}
                  title={t('operationalStudies')}
                  link="/operational-studies/projects"
                  data-testid="operationalStudies"
                />
              </div>
            </RoleBasedContent>

            <RoleBasedContent
              requiredRoles={REQUIRED_USER_ROLES_FOR.VIEWS.STDCM}
              disableIfUnauthorized
            >
              <div className="col-6 col-md-5 col-lg-4 col-xl-3">
                <Card img={stdcmImg} title={t('stdcm')} link="/stdcm" openInNewTab />
              </div>
            </RoleBasedContent>
          </div>
          <div className="row justify-content-center">
            <div className="col-12 col-md-10 col-lg-8 col-xl-6">
              <div className="row">
                <RoleBasedContent
                  requiredRoles={REQUIRED_USER_ROLES_FOR.VIEWS.INFRA_EDITOR}
                  disableIfUnauthorized
                >
                  <div className="col-6 col-sm-4 ">
                    <Card img={editorImg} title={t('editor')} link="/editor" />
                  </div>
                </RoleBasedContent>

                <RoleBasedContent
                  requiredRoles={REQUIRED_USER_ROLES_FOR.VIEWS.ROLLING_STOCK_EDITOR}
                  disableIfUnauthorized
                >
                  <div className="col-6 col-sm-4 ">
                    <Card
                      img={rollingStockEditorImg}
                      title={t('rollingStockEditor')}
                      link="/rolling-stock-editor"
                    />
                  </div>
                </RoleBasedContent>

                <RoleBasedContent
                  requiredRoles={REQUIRED_USER_ROLES_FOR.VIEWS.MAP}
                  disableIfUnauthorized
                >
                  <div className="col-6 col-sm-4 mt-2 mt-sm-0">
                    <Card img={mapImg} title={t('map')} link="/map" />
                  </div>
                </RoleBasedContent>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ModalProvider>
  );
}
