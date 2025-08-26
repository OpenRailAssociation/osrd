import { useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { STDCM_TRAIN_TIMETABLE_ID } from 'applications/stdcm/consts';
import useProjectedTrainsForStdcm from 'applications/stdcm/hooks/useProjectedTrainsForStdcm';
import type { StdcmSimulationOutputs } from 'applications/stdcm/types';
import { hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ResizableSection from 'common/ResizableSection';
import SpaceTimeChartWrapper, {
  MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/SpaceTimeChartWrapper';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';
import { getWorkScheduleGroupId } from 'reducers/osrdconf/stdcmConf/selectors';

const SDD_INITIAL_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;
const MANCHETTE_HEIGHT_DIFF = 100;

type StdcmDebugResultsProps = {
  simulationOutputs?: StdcmSimulationOutputs;
};

const StdcmDebugResults = ({ simulationOutputs }: StdcmDebugResultsProps) => {
  const workScheduleGroupId = useSelector(getWorkScheduleGroupId);
  const successfulSimulation = hasResults(simulationOutputs) ? simulationOutputs : undefined;

  const [SDDWrapperHeight, setSDDWrapperHeight] = useState(SDD_INITIAL_HEIGHT);
  const { t } = useTranslation('stdcm');

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const projectedData = useProjectedTrainsForStdcm(successfulSimulation?.results);

  const { data: workSchedules } = osrdEditoastApi.endpoints.postWorkSchedulesProjectPath.useQuery(
    workScheduleGroupId && successfulSimulation
      ? {
          body: {
            path_track_ranges:
              successfulSimulation.results.pathfinding_result.path.track_section_ranges || [],
            work_schedule_group_id: workScheduleGroupId,
          },
        }
      : skipToken
  );

  if (!successfulSimulation) return null;
  const { pathProperties, results, speedDistanceDiagramData } = successfulSimulation;

  return (
    <div className="stdcm-debug-results">
      {projectedData && pathProperties.manchetteOperationalPoints && (
        <ResizableSection
          height={manchetteWithSpaceTimeChartHeight}
          setHeight={setManchetteWithSpaceTimeChartHeight}
          minHeight={MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT}
        >
          <div
            className="osrd-simulation-container mb-2"
            style={{
              height: manchetteWithSpaceTimeChartHeight,
            }}
          >
            <p className="mt-2 mb-3 ml-4 font-weight-bold">{t('spaceTimeGraphic')}</p>
            <div className="chart-container mt-2">
              <SpaceTimeChartWrapper
                operationalPoints={pathProperties.manchetteOperationalPoints}
                selectedTrainId={STDCM_TRAIN_TIMETABLE_ID}
                projectPathTrainResult={projectedData.spaceTimeData}
                workSchedules={workSchedules}
                projectionLoaderData={projectedData.projectionLoaderData}
                height={manchetteWithSpaceTimeChartHeight - MANCHETTE_HEIGHT_DIFF}
                selectedProjectionId={STDCM_TRAIN_TIMETABLE_ID}
              />
            </div>
          </div>
        </ResizableSection>
      )}

      <div className="osrd-simulation-container my-2">
        <div
          className="chart-container"
          style={{
            height: `${SDDWrapperHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
          }}
        >
          <SpeedDistanceDiagramWrapper
            timetableItemSimulation={results.simulation}
            selectedTimetableItemPowerRestrictions={
              speedDistanceDiagramData.formattedPowerRestrictions
            }
            pathProperties={speedDistanceDiagramData.formattedPathProperties}
            height={SDDWrapperHeight}
            setHeight={setSDDWrapperHeight}
            rollingStock={speedDistanceDiagramData.rollingStock}
          />
        </div>
      </div>
    </div>
  );
};

export default StdcmDebugResults;
