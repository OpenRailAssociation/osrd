import { Lock } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBar from 'common/NavBar';
import { useCurrentInfra } from 'modules/infra/useInfra';

import Editor from './Editor';

export default function HomeEditorUnplugged() {
  const { t } = useTranslation();
  const { data: infra } = useCurrentInfra();

  return (
    <ModalProvider>
      <NavBar
        appName={
          <>
            {t('editor')}
            {infra ? (
              <span className="ml-2 text-muted">
                <span>{`${t('infrastructure')} ${infra.name}`}</span>
                {infra.locked && (
                  <span className="ml-2 text-yellow">
                    <Lock />
                  </span>
                )}
              </span>
            ) : (
              <span className="ml-2 text-orange">{t('infraManagement.noInfraSelected')}</span>
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
