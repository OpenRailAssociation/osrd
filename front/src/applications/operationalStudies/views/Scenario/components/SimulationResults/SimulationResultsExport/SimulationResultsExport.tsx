import { Button } from '@osrd-project/ui-core';
import { Download, File } from '@osrd-project/ui-icons';
import { pdf } from '@react-pdf/renderer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RollingStockWithLiveries,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import SimulationReportSheet from 'modules/SimulationReportSheet';
import type { Train } from 'reducers/osrdconf/types';

import exportTrainCSV from './exportTrainCSV';
import useFormattedOperationalPoints from './useFormattedOperationalPoints';

const exportTrainPDF = async (
  path: PathfindingResultSuccess,
  scenarioData: { name: string; infraName: string },
  train: Train,
  simulation: SimulationResponseSuccess,
  rollingStock: RollingStockWithLiveries,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  t: TFunction<'stdcm'>,
  mapCanvas?: string
) => {
  const doc = (
    <SimulationReportSheet
      path={path}
      scenarioData={scenarioData}
      trainData={{
        trainName: train.train_name,
        departure_time: '',
        simulation,
        creationDate: new Date(),
        rollingStock,
        speedLimitByTag: train.speed_limit_tag,
      }}
      operationalPointsList={operationalPoints}
      mapCanvas={mapCanvas}
      t={t}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);

  // Create a temporary link element for better browser compatibility
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.click();

  // Keep the blob alive so Chrome viewer can download it later
  const onPageHide = () => URL.revokeObjectURL(url);
  window.addEventListener('pagehide', onPageHide, { once: true });
};

type SimulationResultsExportProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  train: Train;
  simulation: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  rollingStock: RollingStockWithLiveries;
  mapCanvas?: string;
};

const SimulationResultsExport = ({
  path,
  scenarioData,
  train,
  simulation,
  pathProperties,
  rollingStock,
  mapCanvas,
}: SimulationResultsExportProps) => {
  const { t } = useTranslation('operational-studies');
  const { t: tSimulationReportSheet } = useTranslation('stdcm');

  const operationalPoints = useFormattedOperationalPoints(train, simulation, pathProperties);

  return (
    <div className="simulation-sheet-container">
      <Button
        onClick={() =>
          exportTrainPDF(
            path,
            scenarioData,
            train,
            simulation,
            rollingStock,
            operationalPoints,
            tSimulationReportSheet,
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
          exportTrainCSV(simulation, operationalPoints, pathProperties.electrifications, train)
        }
        variant="Quiet"
        label=".csv"
        size="medium"
        leadingIcon={<Download />}
      />
    </div>
  );
};

export default SimulationResultsExport;
