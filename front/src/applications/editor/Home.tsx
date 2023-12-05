import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Route, Routes } from 'react-router-dom';
import { GoLock } from 'react-icons/go';

import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import Editor from './Editor';

export default function HomeEditorUnplugged() {
  const { t } = useTranslation(['home/home', 'referenceMap']);
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
    <ModalProvider>
      <NavBarSNCF
        appName={
          <>
            {t('editor')}
            {infra ? (
              <span className="ml-2 text-muted">
                <span>{t('referenceMap:infrastructure', { name: infra.name })}</span>
                {infra.locked && (
                  <span className="ml-2">
                    <GoLock />
                  </span>
                )}
              </span>
            ) : (
              <span className="ml-2 text-orange">{t('referenceMap:mapNoInfraSelected')}</span>
            )}
          </>
        }
      />
      <div className="no-mastnav">
        <Routes>
          <Route path="/" element={<Editor />} />
          <Route path="/:urlInfra" element={<Editor />} />
        </Routes>
      </div>
    </ModalProvider>
  );
}
