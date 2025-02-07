import { Text, Image, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import styles from 'applications/stdcm/components/SimulationReportSheet/SimulationReportStyleSheet';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';

import type { SimulationSheetData } from '../SimulationResultExport/types';

interface HeaderProps {
  trainData: SimulationSheetData;
  scenarioData: { name: string; infraName: string };
}

const Header = ({ trainData, scenarioData }: HeaderProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);
  const { trainName } = trainData;

  const headerTitle = t('operationalStudies/study:simulationSheet');

  const { name: scenarioName, infraName } = scenarioData;

  return (
    <View style={styles.header.numberDateBanner}>
      <View style={styles.header.stdcmTitleBox}>
        <View style={styles.header.stdcm}>
          <Text style={styles.header.title}>{headerTitle}</Text>
        </View>
      </View>
      <View style={styles.header.numericInfo}>
        <Text style={styles.header.cardContent}>{trainName}</Text>
      </View>
      <View style={styles.header.numericInfo}>
        <Text style={styles.header.cardContent}>
          {t('operationalStudies/study:scenarioWithTwoPoints')}
          {scenarioName}
        </Text>
      </View>
      <View style={styles.header.numericInfo}>
        <Text style={styles.header.cardContent}>
          {t('operationalStudies/study:infrastructureWithTwoPoints')}
          {infraName}
        </Text>
      </View>
      <Image src={logoSNCF} style={styles.header.sncfLogo} />
    </View>
  );
};

export default Header;
