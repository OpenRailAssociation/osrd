import { useTranslation } from 'react-i18next';

import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';

import RollingStockEditor from './views/RollingStockEditor';

const HomeRollingStockEditor = () => {
  const { t } = useTranslation();

  return (
    <ModalProvider>
      <NavBarSNCF appName={<>{t('rollingStockEditor')}</>} />
      <RollingStockEditor />
    </ModalProvider>
  );
};

export default HomeRollingStockEditor;
