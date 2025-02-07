import { Text, Image } from '@react-pdf/renderer';
import type { TFunction } from 'i18next';

import styles from './SimulationReportStyleSheet';

const LogoSTDCM = ({ logo, t }: { logo: string | undefined; t: TFunction }) => {
  if (logo) {
    return <Image src={logo} style={styles.header.lmrLogo} />;
  }
  return (
    <>
      <Text style={styles.header.title}>{t('stdcm')}</Text>
      <Text style={styles.header.creation}>{t('stdcmSimulation')}</Text>
    </>
  );
};

export default LogoSTDCM;
