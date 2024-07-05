import React, { useEffect } from 'react';

import { Lock } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { useInfraActions, useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';
import { getLogo } from 'utils/logo';

import Map from './Map';

const HomeReferenceMap = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);
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
      getInfraByInfraId({ infraId: infraID as number }).then((resp) => {
        if (resp.error && 'status' in resp.error && resp.error.status === 404) {
          dispatch(updateInfraID(undefined));
        }
      });
    }
  }, [infraID, getInfraByInfraId, dispatch]);

  return (
    <ModalProvider>
      <NavBarSNCF
        logo={getLogo()}
        appName={
          <>
            {t('map')}
            {infra ? (
              <span className="ml-2 text-muted">
                {t('referenceMap:infrastructure', { name: infra.name })}
                <span className="ml-2">{infra.locked && <Lock />}</span>
              </span>
            ) : (
              <span className="ml-2 text-orange">{t('referenceMap:mapNoInfraSelected')}</span>
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
