import { Text, Image } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import styles from './style/SimulationReportStyleSheet';

const LogoSTDCM = ({ logoUrl }: { logoUrl?: string }) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet']);
  if (logoUrl) {
    return <Image src={logoUrl} style={styles.header.lmrLogo} />;
  }
  return (
    <>
      <Text style={styles.header.title}>{t('stdcm')}</Text>
      <Text style={styles.header.creation}>{t('stdcmCreation')}</Text>
    </>
  );
};

export default LogoSTDCM;
