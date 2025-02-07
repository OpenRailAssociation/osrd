import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmResultsOperationalPoint, StdcmSuccessResponse } from 'applications/stdcm/types';

import styles from './SimulationReportStyleSheet';
import SimulationTable from './SimulationTable';

interface SimulationProps {
  stdcmData: StdcmSuccessResponse;
  operationalPointsList: StdcmResultsOperationalPoint[];
  consistMass: number;
  consistLength: number;
}

const Simulation = ({
  stdcmData,
  operationalPointsList,
  consistMass,
  consistLength,
}: SimulationProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);

  return (
    <View style={styles.simulation.simulation}>
      <View style={styles.simulation.simulationContainer}>
        <Text style={styles.simulation.simulationUppercase}>{t('simulation')}</Text>
        <Text style={styles.simulation.simulationLength}>
          {`${Math.round(stdcmData.path.length / 1000000)} km`}
        </Text>
      </View>
      <SimulationTable {...{ stdcmData, operationalPointsList, consistMass, consistLength }} />
    </View>
  );
};

export default Simulation;
