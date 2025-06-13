import { Button } from '@osrd-project/ui-core';
import { Download, File } from '@osrd-project/ui-icons';
import { pdf } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import type { TimetableItem } from 'reducers/osrdconf/types';

import exportTrainCSV from './exportTrainCSV';
import SimulationReportSheetScenario from './SimulationReportSheetScenario';
import { useFormattedOperationalPoints } from '../hooks/useFormattedOperationalPoints';

const exportTrainPDF = async (
  path: PathfindingResultSuccess,
  scenarioData: { name: string; infraName: string },
  timetableItem: TimetableItem,
  simulation: SimulationResponseSuccess,
  rollingStock: RollingStockWithLiveries,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  mapCanvas?: string
) => {
  const doc = (
    <SimulationReportSheetScenario
      path={path}
      scenarioData={scenarioData}
      trainData={{
        trainName: timetableItem.train_name,
        departure_time: '',
        simulation,
        creationDate: new Date(),
        rollingStock,
        speedLimitByTag: timetableItem.speed_limit_tag,
      }}
      operationalPointsList={operationalPoints}
      mapCanvas={mapCanvas}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  URL.revokeObjectURL(url);
};

type SimulationResultExportProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  timetableItem: TimetableItem;
  simulation: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  rollingStock: RollingStockWithLiveries;
  mapCanvas?: string;
};

const SimulationResultExport = ({
  path,
  scenarioData,
  timetableItem,
  simulation,
  pathProperties,
  rollingStock,
  mapCanvas,
}: SimulationResultExportProps) => {
  const { t } = useTranslation('operational-studies');

  const operationalPoints = useFormattedOperationalPoints(
    timetableItem,
    simulation,
    pathProperties
  );

  return (
    <div className="simulation-sheet-container">
      <Button
        onClick={() =>
          exportTrainPDF(
            path,
            scenarioData,
            timetableItem,
            simulation,
            rollingStock,
            operationalPoints,
            mapCanvas
          )
        }
        variant="Quiet"
        label={t('simulationResults.simulationSheet')}
        size="medium"
        leadingIcon={<File />}
      />

      <Button
        onClick={() =>
          exportTrainCSV(
            simulation,
            operationalPoints,
            pathProperties.electrifications,
            timetableItem
          )
        }
        variant="Quiet"
        label=".csv"
        size="medium"
        leadingIcon={<Download />}
      />
    </div>
  );
};

export default SimulationResultExport;
