import { useMemo } from 'react';

import { Button } from '@osrd-project/ui-core';
import { Download, File } from '@osrd-project/ui-icons';
import { BlobProvider } from '@react-pdf/renderer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type {
  RollingStockWithLiveries,
  ScenarioResponse,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import {
  BaseOrEco,
  type BaseOrEcoType,
} from 'modules/trainschedule/components/DriverTrainSchedule/consts';
import exportTrainCSV from 'modules/trainschedule/components/DriverTrainSchedule/exportDriverScheduleCSV';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainSchedule/types';

import SimulationReportSheetScenario, {
  type SimulationReportSheetScenarioProps,
  type SimulationSheetData,
} from './SimulationReportSheetScenario';

const Blob = ({
  scenarioResponse,
  simulationType,
  scenarioData,
  simulationReportSheetNumber,
  mapCanvas,
  operationalPointsList,
  t,
}: SimulationReportSheetScenarioProps & { t: TFunction }) => (
  <BlobProvider
    document={
      <SimulationReportSheetScenario
        scenarioResponse={scenarioResponse}
        simulationType={simulationType}
        scenarioData={scenarioData}
        simulationReportSheetNumber={simulationReportSheetNumber}
        operationalPointsList={operationalPointsList}
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
);

type SimulationResultExportProps = {
  scenario: ScenarioResponse;
  train: TrainScheduleBase;
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  operationalPoints: {
    base: OperationalPointWithTimeAndSpeed[];
    finalOutput: OperationalPointWithTimeAndSpeed[];
  };
  baseOrEco: BaseOrEcoType;
  rollingStock: RollingStockWithLiveries;
  mapCanvas?: string;
};

const SimulationResultExport = ({
  scenario,
  train,
  simulatedTrain,
  pathProperties,
  operationalPoints,
  baseOrEco,
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
      speedLimitByTag: 'speedLimitByTag',
    }),
    [simulatedTrain]
  );

  const operationalPointsToUse = useMemo(
    () => (baseOrEco === BaseOrEco.eco ? operationalPoints?.finalOutput : operationalPoints?.base),
    [baseOrEco, operationalPoints]
  );

  return (
    <div className="simulation-sheet-container">
      <Blob
        scenarioResponse={scenario}
        simulationType="scenario"
        scenarioData={simulationSheetData}
        simulationReportSheetNumber={undefined}
        operationalPointsList={operationalPointsToUse}
        t={t}
        mapCanvas={mapCanvas}
      />
      <Button
        onClick={() =>
          exportTrainCSV(
            simulatedTrain,
            operationalPointsToUse,
            pathProperties.electrifications,
            baseOrEco,
            train
          )
        }
        variant="Quiet"
        label=".CSV"
        leadingIcon={<Download />}
      />
    </div>
  );
};

export default SimulationResultExport;
