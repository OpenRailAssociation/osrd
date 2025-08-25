import { useEffect } from 'react';

import { Lock } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBar from 'common/NavBar';
import { useInfraActions, useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';

import Map from './Map';

const HomeReferenceMap = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { updateInfraID } = useInfraActions();
  const infraID = useInfraID();
  const [getInfraByInfraId, { data: infra }] =
    osrdEditoastApi.endpoints.getInfraByInfraId.useLazyQuery({});

  /**
   * When infra id changes
   * => fetch it
   */
  useEffect(() => {
    if (infraID) {
      // if the infra in the store is not found, then we set it to undefined
      getInfraByInfraId({ infraId: infraID }).then((resp) => {
        if (resp.error && 'status' in resp.error && resp.error.status === 404) {
          dispatch(updateInfraID(undefined));
        }
      });
    }
  }, [infraID, getInfraByInfraId, dispatch]);

  return (
    <ModalProvider>
      <NavBar
        appName={
          <>
            {t('map')}
            {infra ? (
              <span className="ml-2 text-muted">
                {`${t('infrastructure')} ${infra.name}`}
                <span className="ml-2">{infra.locked && <Lock />}</span>
              </span>
            ) : (
              <span className="ml-2 text-orange">{t('infraManagement.noInfraSelected')}</span>
            )}
          </>
        }
      />
      <div className="no-mastnav">
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/:urlLat/:urlLon/:urlZoom/:urlBearing/:urlPitch" element={<Map />} />
        </Routes>
      </div>
    </ModalProvider>
  );
};

export default HomeReferenceMap;
