import { Text, View, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import styles from 'applications/stdcm/components/SimulationReportSheet/SimulationReportStyleSheet';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';

import SimulationTable from './SimulationTable';
import type { SimulationSheetData } from '../SimulationResultExport/types';

interface SimulationProps {
  trainData: SimulationSheetData;
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
  path: PathfindingResultSuccess;
}

const Simulation = ({ trainData, operationalPointsList, path }: SimulationProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);

  return (
    <View style={styles.simulation.simulation}>
      <View style={styles.simulation.simulationContainer}>
        <Text style={styles.simulation.simulationUppercase}>{t('simulation')}</Text>
        <Link href="#simulationMap" src="#simulationMap" style={styles.simulation.viewSimulation}>
          {t('viewSimulation')}
        </Link>
        <Text style={styles.simulation.simulationLength}>
          {`${Math.round(path.length / 1000000)} km`}
        </Text>
      </View>
      <SimulationTable {...{ trainData, operationalPointsList, path }} />
    </View>
  );
};

export default Simulation;
