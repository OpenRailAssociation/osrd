import { Text, Image, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import { formatDateToString } from 'utils/date';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import LogoSTDCM from './LogoSTDCM';
import styles from './SimulationReportStyleSheet';

interface HeaderProps {
  simulationReportSheetNumber: string;
  stdcmData: StdcmSuccessResponse;
}

const Header = ({ simulationReportSheetNumber, stdcmData }: HeaderProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  const { stdcmSimulationSheetLogo } = useDeploymentSettings();
  const { creationDate } = stdcmData;

  return (
    <>
      <View style={styles.header.alertBanner}>
        <Image src={iconAlert} style={styles.header.alertIcon} />
        <Text style={styles.header.simulationTitle}>{t('simulation')}</Text>
        <Text style={styles.header.message}>{t('warningMessage')}</Text>
      </View>
      <View style={styles.header.numberDateBanner}>
        <View style={styles.header.stdcmTitleBox}>
          <View style={styles.header.stdcm}>
            <LogoSTDCM logo={stdcmSimulationSheetLogo} t={t} />
          </View>
        </View>
        <View style={styles.header.numericInfo}>
          <Text style={styles.header.number}>
            n°
            {simulationReportSheetNumber}
          </Text>
          <Text style={styles.header.creationDate}>
            {t('formattedDate', formatDateToString(creationDate))}
          </Text>
        </View>
        <Image src={logoSNCF} style={styles.header.sncfLogo} />
      </View>
    </>
  );
};

export default Header;
