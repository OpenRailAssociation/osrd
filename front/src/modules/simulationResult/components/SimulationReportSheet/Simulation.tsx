/* eslint-disable no-nested-ternary */
import { Text, View, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmResultsOperationalPoint, StdcmSuccessResponse } from 'applications/stdcm/types';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';

import SimulationTable from './SimulationTable';
import styles from './style/SimulationReportStyleSheet';
import type { SimulationSheetData } from '../SimulationResultExport/types';

interface SimulationProps {
  trainData?: SimulationSheetData;
  stdcmData?: StdcmSuccessResponse;
  operationalPointsList: OperationalPointWithTimeAndSpeed[] | StdcmResultsOperationalPoint[];
  path?: PathfindingResultSuccess;
  consistMass?: number;
  consistLength?: number;
}

const Simulation = ({
  trainData,
  stdcmData,
  operationalPointsList,
  path,
  consistMass,
  consistLength,
}: SimulationProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);

  const simulationLength = path
    ? Math.round(path.length / 1000000)
    : stdcmData
      ? Math.round(stdcmData.path.length / 1000000)
      : 0;

  return (
    <View style={styles.simulation.simulation}>
      <View style={styles.simulation.simulationContainer}>
        <Text style={styles.simulation.simulationUppercase}>{t('simulation')}</Text>
        {path && (
          <Link href="#simulationMap" src="#simulationMap" style={styles.simulation.viewSimulation}>
            {t('viewSimulation')}
          </Link>
        )}
        <Text style={styles.simulation.simulationLength}>{`${simulationLength} km`}</Text>
      </View>
      <SimulationTable
        {...(trainData
          ? { trainData, operationalPointsList, path }
          : { stdcmData, operationalPointsList, consistMass, consistLength })}
      />
    </View>
  );
};

export default Simulation;
