import { useMemo } from 'react';

import { Button } from '@osrd-project/ui-core';
import { Download, File } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import {
  BaseOrEco,
  type BaseOrEcoType,
} from 'modules/trainschedule/components/DriverTrainSchedule/consts';
import exportTrainCSV from 'modules/trainschedule/components/DriverTrainSchedule/exportDriverScheduleCSV';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainSchedule/types';

type SimulationResultExportProps = {
  train: TrainScheduleBase;
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  operationalPoints: {
    base: OperationalPointWithTimeAndSpeed[];
    finalOutput: OperationalPointWithTimeAndSpeed[];
  };
  baseOrEco: BaseOrEcoType;
};

const SimulationResultExport = ({
  train,
  simulatedTrain,
  pathProperties,
  operationalPoints,
  baseOrEco,
}: SimulationResultExportProps) => {
  const { t } = useTranslation('simulation');

  const operationalPointsToUse = useMemo(
    () => (baseOrEco === BaseOrEco.eco ? operationalPoints?.finalOutput : operationalPoints?.base),
    [baseOrEco, operationalPoints]
  );
  return (
    <div className="simulation-sheet-container">
      <Button
        onClick={() => console.log('Simulation Sheet')}
        variant="Quiet"
        label={t('simulationSheet')}
        leadingIcon={<File />}
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
