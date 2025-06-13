import { useCallback, useMemo } from 'react';

import { Button } from '@osrd-project/ui-core';
import { Download, File } from '@osrd-project/ui-icons';
import { pdf } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type {
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
import type { SimulationSheetData } from './types';
import { useFormattedOperationalPoints } from '../hooks/useFormattedOperationalPoints';

type SimulationResultExportProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  timetableItem: TimetableItem;
  simulatedTimetableItem: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  rollingStock: RollingStockWithLiveries;
  mapCanvas?: string;
};

const SimulationResultExport = ({
  path,
  scenarioData,
  timetableItem,
  simulatedTimetableItem,
  pathProperties,
  rollingStock,
  mapCanvas,
}: SimulationResultExportProps) => {
  const { t } = useTranslation('operational-studies');

  const operationalPoints = useFormattedOperationalPoints(
    timetableItem,
    simulatedTimetableItem,
    pathProperties
  );

  const simulationSheetData: SimulationSheetData = useMemo(
    () => ({
      trainName: timetableItem.train_name,
      departure_time: '',
      simulation: simulatedTimetableItem,
      creationDate: new Date(),
      rollingStock,
      speedLimitByTag: timetableItem.speed_limit_tag,
    }),
    [simulatedTimetableItem]
  );

  const exportTrainPDF = useCallback(async () => {
    const doc = (
      <SimulationReportSheetScenario
        path={path}
        scenarioData={scenarioData}
        trainData={simulationSheetData}
        operationalPointsList={operationalPoints}
        mapCanvas={mapCanvas}
      />
    );
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
  }, [path, scenarioData, simulationSheetData, operationalPoints, mapCanvas]);

  return (
    <div className="simulation-sheet-container">
      {/* Export simulation PDF */}
      <Button
        onClick={exportTrainPDF}
        variant="Quiet"
        label={t('simulationResults.simulationSheet')}
        size="medium"
        leadingIcon={<File />}
      />

      {/* Export simulation CSV */}
      <Button
        onClick={() =>
          exportTrainCSV(
            simulatedTimetableItem,
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
