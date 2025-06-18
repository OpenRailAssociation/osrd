import { Text, Image } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import styles from './styles/SimulationReportStyleSheet';

const StdcmLogo = ({ logoUrl }: { logoUrl?: string }) => {
  const { t } = useTranslation('stdcm');
  if (logoUrl) {
    return <Image src={logoUrl} style={styles.header.stdcmLogo} />;
  }
  return (
    <>
      <Text style={styles.header.title}>{t('reportSheet.stdcm')}</Text>
      <Text style={styles.header.creation}>{t('reportSheet.stdcmCreation')}</Text>
    </>
  );
};

export default StdcmLogo;
