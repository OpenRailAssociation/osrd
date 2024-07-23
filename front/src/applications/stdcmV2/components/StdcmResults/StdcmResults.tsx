import React, { useMemo, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { CheckCircle } from '@osrd-project/ui-icons';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import SimulationReportSheetV2 from 'applications/stdcm/components/SimulationReportSheetV2';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import {
  generateCodeNumber,
  getOperationalPointsWithTimes,
} from 'applications/stdcm/utils/formatSimulationReportSheet';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import { dateTimeFormatting } from 'utils/date';

import StcdmResultsTable from './StdcmResultsTable';
import StdcmUpgrade from './StdcmUpgrade';

type StcdmResultsV2Props = {
  stdcmData: StdcmV2SuccessResponse;
  pathProperties?: ManageTrainSchedulePathProperties;
  setInteractedResultsElements: (interactedResultsElements: boolean) => void;
};

const StcdmResults = ({
  stdcmData,
  pathProperties,
  setInteractedResultsElements,
}: StcdmResultsV2Props) => {
  const { t } = useTranslation('stdcm');
  const withoutTime = false;
  const date = dateTimeFormatting(stdcmData.creationDate, withoutTime, 'alternate');

  const [isSimulationSelected, setIsSimulationSelected] = useState(false);

  const [mapCanvas, setMapCanvas] = useState<string>();

  const simulationReportSheetNumber = generateCodeNumber();

  const operationalPointsList = useMemo(
    () =>
      getOperationalPointsWithTimes(
        pathProperties?.suggestedOperationalPoints || [],
        stdcmData.simulation,
        stdcmData.departure_time
      ),
    [pathProperties, stdcmData]
  );

  return (
    <main className="stdcm-v2-results">
      <div className="simuation-banner">
        <div
          className="simulation-validated"
          style={{ color: isSimulationSelected ? '#0B723C' : '' }}
        >
          {t('simulation.results.simulationNumber')}
          {isSimulationSelected && (
            <div className="check-circle">
              <CheckCircle variant="fill" />
            </div>
          )}
        </div>
        <div className="creation-date">{date}</div>
      </div>
      <div className="simuation-results">
        <div className="results-and-sheet">
          <StcdmResultsTable
            stdcmData={stdcmData}
            operationalPointsList={operationalPointsList}
            isSimulationSelected={isSimulationSelected}
            setIsSimulationSelected={setIsSimulationSelected}
            setInteractedResultsElements={setInteractedResultsElements}
          />
          <StdcmUpgrade />
          {isSimulationSelected && (
            <div className="get-simulation">
              <div className="download-simulation">
                <PDFDownloadLink
                  document={
                    <SimulationReportSheetV2
                      stdcmData={stdcmData}
                      simulationReportSheetNumber={simulationReportSheetNumber}
                      mapCanvas={mapCanvas}
                      operationalPointsList={operationalPointsList}
                    />
                  }
                  fileName={`STDCM-${simulationReportSheetNumber}.pdf`}
                >
                  <Button label={t('simulation.results.downloadSimulationSheet')} />
                </PDFDownloadLink>
              </div>
              <div className="gesico-text">{t('simulation.results.gesicoRequest')}</div>
            </div>
          )}
        </div>
        <div className="osrd-config-item-container osrd-config-item-container-map map-results">
          <Map hideAttribution setMapCanvas={setMapCanvas} pathProperties={pathProperties} />
        </div>
      </div>
    </main>
  );
};

export default StcdmResults;
