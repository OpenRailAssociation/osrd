import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { useSelector } from 'react-redux';
import config from 'config/config';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/map.svg';
import { get } from 'common/requests';
import { FaLock } from 'react-icons/fa';
import Map from './Map';

const INFRA_URL = '/editoast/infra/';

export default function HomeReferenceMap() {
  const { t } = useTranslation(['home', 'referenceMap']);
  const [infra, setInfra] = useState();
  const infraID = useSelector(getInfraID);

  async function getInfra() {
    try {
      const result = await get(`${INFRA_URL}${infraID}/`);
      setInfra(result);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (infraID) {
      getInfra();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  return (
    <>
      <NavBarSNCF
        appName={
          <>
            {t('map')}
            {infraID && infra ? (
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
          <Route path="/" element={<Map urlmap={config.proxy} />} />
          <Route
            path="/:urlLat/:urlLon/:urlZoom/:urlBearing/:urlPitch"
            element={<Map urlmap={config.proxy} />}
          />
        </Routes>
      </div>
    </>
  );
}
