/* eslint-disable no-nested-ternary */
import { Text, Image, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import { formatDateToString } from 'utils/date';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import LogoSTDCM from './LogoSTDCM';
import styles from './style/SimulationReportStyleSheet';
import type { SimulationSheetData } from '../SimulationResultExport/types';

interface HeaderProps {
  simulationReportSheetNumber?: string;
  stdcmData?: StdcmSuccessResponse;
  trainData?: SimulationSheetData;
  scenarioData?: { name: string; infraName: string };
}

const Header = ({
  simulationReportSheetNumber,
  stdcmData,
  trainData,
  scenarioData,
}: HeaderProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);
  const deploymentSettings = useDeploymentSettings();
  const stdcmSimulationSheetLogo = deploymentSettings?.stdcmSimulationSheetLogo;

  return (
    <>
      {stdcmData && simulationReportSheetNumber ? (
        <View style={styles.header.alertBanner}>
          <Image src={iconAlert} style={styles.header.alertIcon} />
          <Text style={styles.header.simulationTitle}>{t('simulation')}</Text>
          <Text style={styles.header.message}>{t('warningMessage')}</Text>
        </View>
      ) : null}
      <View style={styles.header.numberDateBanner}>
        <View style={styles.header.stdcmTitleBox}>
          <View style={styles.header.stdcm}>
            {stdcmData && simulationReportSheetNumber ? (
              <LogoSTDCM logoUrl={stdcmSimulationSheetLogo} />
            ) : (
              <Text style={styles.header.title}>
                {t('operationalStudies/study:simulationSheet')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.header.numericInfo}>
          {stdcmData && simulationReportSheetNumber ? (
            <>
              <Text style={styles.header.number}>n°{simulationReportSheetNumber}</Text>
              <Text style={styles.header.creationDate}>
                {t('formattedDate', formatDateToString(stdcmData.creationDate))}
              </Text>
            </>
          ) : trainData && scenarioData ? (
            <>
              <Text style={styles.header.cardContent}>{trainData.trainName}</Text>
              <Text style={styles.header.cardContent}>
                {t('operationalStudies/study:scenarioWithTwoPoints')} {scenarioData.name}
              </Text>
              <Text style={styles.header.cardContent}>
                {t('operationalStudies/study:infrastructureWithTwoPoints')} {scenarioData.infraName}
              </Text>
            </>
          ) : null}
        </View>
        <Image src={logoSNCF} style={styles.header.sncfLogo} />
      </View>
    </>
  );
};

export default Header;
