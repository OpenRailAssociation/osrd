import React, { useRef, useEffect, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
// import { Location, ArrowUp, ArrowDown } from '@osrd-project/ui-icons';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import type {
  PathfindingResultSuccess,
  PostV2InfraByInfraIdPathPropertiesApiArg,
} from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { formatSuggestedOperationalPoints, upsertViasInOPs } from 'modules/pathfinding/utils';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { getTrainScheduleV2Activated } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';

import StdcmViewResultsV2 from './StdcmViewResultsV2';
import StdcmConsist from '../components/StdcmConsist';
// import StdcmDefaultCard from '../components/StdcmDefaultCard';
import StdcmDestination from '../components/StdcmDestination';
import StdcmHeader from '../components/StdcmHeader';
import StdcmLoader from '../components/StdcmLoader';
import StdcmOrigin from '../components/StdcmOrigin';

const StdcmViewV2 = () => {
  const { getScenarioID } = useOsrdConfSelectors();
  const scenarioID = useSelector(getScenarioID);
  const { launchStdcmRequest, cancelStdcmRequest, currentStdcmRequestStatus, stdcmV2Results } =
    useStdcm();
  const isPending = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending;
  const loaderRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('stdcm');
  const [creationDate, setCreationDate] = useState<Date>();
  const { rollingStock } = useStoreDataForRollingStockSelector();
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);

  const handleClick = () => {
    const currentDateTime = new Date();
    setCreationDate(currentDateTime);
    launchStdcmRequest();
  };

  const dispatch = useAppDispatch();
  const { updateGridMarginAfter, updateGridMarginBefore, updateStdcmStandardAllowance } =
    useOsrdConfActions() as StdcmConfSliceActions;

  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();

  const [postPathProperties] =
    enhancedEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();
  const { getPathSteps } = useOsrdConfSelectors();
  const pathSteps = useSelector(getPathSteps);
  const infraId = useInfraID();

  useEffect(() => {
    const getPathProperties = async (_infraId: number, path: PathfindingResultSuccess) => {
      const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
        infraId: _infraId,
        props: ['electrifications', 'geometry', 'operational_points'],
        pathPropertiesInput: {
          track_section_ranges: path.track_section_ranges,
        },
      };
      const { geometry, operational_points, electrifications } =
        await postPathProperties(pathPropertiesParams).unwrap();

      if (geometry && operational_points && electrifications) {
        const pathStepsWihPosition = compact(pathSteps).map((step, i) => ({
          ...step,
          positionOnPath: path.path_items_positions[i],
        }));

        const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
          operational_points,
          geometry,
          path.length
        );

        const updatedSuggestedOPs = upsertViasInOPs(
          suggestedOperationalPoints,
          pathStepsWihPosition
        );

        setPathProperties({
          electrifications,
          geometry,
          suggestedOperationalPoints: updatedSuggestedOPs,
          allVias: updatedSuggestedOPs,
          length: path.length,
        });
      }
    };

    if (infraId && stdcmV2Results) {
      const { path } = stdcmV2Results;
      getPathProperties(infraId, path);
    }
  }, [stdcmV2Results]);

  useEffect(() => {
    if (isPending) {
      loaderRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isPending]);

  useEffect(() => {
    dispatch(updateGridMarginAfter(35));
    dispatch(updateGridMarginBefore(35));
    dispatch(updateStdcmStandardAllowance({ type: 'time_per_distance', value: 4.5 }));
  }, []);

  return (
    <div className="stdcm-v2">
      <StdcmHeader />
      {scenarioID && (
        <div className="stdcm-v2__body">
          <div className="stdcm-v2-simulation-settings">
            <div className="stdcm-v2-consist-container">
              <StdcmConsist disabled={isPending} />
            </div>
            <div className="stdcm-v2__separator" />
            <div className="stdcm-v2-simulation-itinerary">
              {/* //TODO: rename StdcmDefaultCard */}
              {/* <StdcmDefaultCard text="Indiquer le sillon antérieur" Icon={<ArrowUp size="lg" />} /> */}
              <StdcmOrigin disabled={isPending} />
              {/* <StdcmDefaultCard text="Ajouter un passage" Icon={<Location size="lg" />} /> */}
              <StdcmDestination disabled={isPending} />
              {/* <StdcmDefaultCard text="Indiquer le sillon postérieur" Icon={<ArrowDown size="lg" />} /> */}
              <div className="stdcm-v2-launch-request">
                <Button label={t('simulation.getSimulation')} onClick={handleClick} />
              </div>
              {isPending && <StdcmLoader cancelStdcmRequest={cancelStdcmRequest} ref={loaderRef} />}
            </div>
          </div>
          <div className="osrd-config-item-container osrd-config-item-container-map stdcm-v2-map">
            <Map hideAttribution />
          </div>
          <div />
        </div>
      )}
      {trainScheduleV2Activated && rollingStock && stdcmV2Results && (
        <StdcmViewResultsV2
          stdcmData={stdcmV2Results}
          pathProperties={pathProperties}
          rollingStockData={rollingStock}
          creationDate={creationDate}
        />
      )}
    </div>
  );
};

export default StdcmViewV2;
