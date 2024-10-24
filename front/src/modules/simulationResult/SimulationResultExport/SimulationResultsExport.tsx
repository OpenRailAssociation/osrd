import { useMemo } from 'react';

import { Button } from '@osrd-project/ui-core';
import { Download, File } from '@osrd-project/ui-icons';
import { BlobProvider } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RollingStockWithLiveries,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';

import exportTrainCSV from './exportTrainCSV';
import SimulationReportSheetScenario from './SimulationReportSheetScenario';
import type { SimulationSheetData } from './types';

type SimulationResultExportProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  train: TrainScheduleBase;
  simulatedTrain: SimulationResponseSuccess;
  pathElectrifications: PathPropertiesFormatted['electrifications'];
  operationalPoints: OperationalPointWithTimeAndSpeed[];
  rollingStock: RollingStockWithLiveries;
  mapCanvas?: string;
};

const SimulationResultExport = ({
  path,
  scenarioData,
  train,
  simulatedTrain,
  pathElectrifications,
  operationalPoints,
  rollingStock,
  mapCanvas,
}: SimulationResultExportProps) => {
  const { t } = useTranslation('simulation');

  const simulationSheetData: SimulationSheetData = useMemo(
    () => ({
      trainName: train.train_name,
      departure_time: '',
      simulation: simulatedTrain,
      creationDate: new Date(),
      rollingStock,
      speedLimitByTag: train.speed_limit_tag,
    }),
    [simulatedTrain]
  );

  return (
    <div className="simulation-sheet-container">
      {/* Export simulation PDF */}
      <BlobProvider
        document={
          <SimulationReportSheetScenario
            path={path}
            scenarioData={scenarioData}
            trainData={simulationSheetData}
            operationalPointsList={operationalPoints}
            mapCanvas={mapCanvas}
          />
        }
      >
        {({ url }) => (
          <Button
            onClick={() => window.open(url as string, '_blank')}
            variant="Quiet"
            label={t('simulationSheet')}
            leadingIcon={<File />}
          />
        )}
      </BlobProvider>

      {/* Export simulation CSV */}
      <Button
        onClick={() =>
          exportTrainCSV(simulatedTrain, operationalPoints, pathElectrifications, train)
        }
        variant="Quiet"
        label=".CSV"
        leadingIcon={<Download />}
      />
    </div>
  );
};

export default SimulationResultExport;
