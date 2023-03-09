import React, { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaLock } from 'react-icons/fa';

import logo from 'assets/pictures/home/map.svg';
import { getInfraID } from 'reducers/osrdconf/selectors';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import Map from './Map';

const HomeReferenceMap: FC = () => {
  const { t } = useTranslation(['home', 'referenceMap']);
  const infraID = useSelector(getInfraID);
  const [getInfraById, { data: infra }] = osrdEditoastApi.endpoints.getInfraById.useLazyQuery({});

  /**
   * When infra id changes
   * => fetch it
   */
  useEffect(() => {
    if (infraID) {
      getInfraById({ id: infraID });
    }
  }, [infraID, getInfraById]);

  return (
    <>
      <NavBarSNCF
        appName={
          <>
            {t('map')}
            {infra ? (
              <span className="ml-2 text-muted">
                {t('referenceMap:infrastructure', { name: infra.name })}
                <span className="ml-2">{infra.locked && <FaLock />}</span>
              </span>
            ) : (
              <span className="ml-2 text-orange">{t('referenceMap:mapNoInfraSelected')}</span>
            )}
          </>
        }
        logo={logo}
      />
      <div className="no-mastnav">
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/:urlLat/:urlLon/:urlZoom/:urlBearing/:urlPitch" element={<Map />} />
        </Routes>
      </div>
    </>
  );
};

export default HomeReferenceMap;
