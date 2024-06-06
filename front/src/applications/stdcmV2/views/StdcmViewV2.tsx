import React, { useRef, useEffect } from 'react';

import { Button } from '@osrd-project/ui-core';
// import { Location, ArrowUp, ArrowDown } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import useStdcm from 'applications/stdcm/hooks/useStdcm';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import StdcmConsist from '../components/StdcmConsist';
// import StdcmDefaultCard from '../components/StdcmDefaultCard';
import StdcmDestination from '../components/StdcmDestination';
import StdcmHeader from '../components/StdcmHeader';
import StdcmLoader from '../components/StdcmLoader';
import StdcmOrigin from '../components/StdcmOrigin';

const StdcmViewV2 = () => {
  const { getScenarioID } = useOsrdConfSelectors();
  const scenarioID = useSelector(getScenarioID);
  const { launchStdcmRequest, cancelStdcmRequest, currentStdcmRequestStatus } = useStdcm();
  const isPending = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending;
  const loaderRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('stdcm');

  const dispatch = useAppDispatch();
  const { updateGridMarginAfter, updateGridMarginBefore, updateStdcmStandardAllowance } =
    useOsrdConfActions() as StdcmConfSliceActions;

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
                <Button
                  label={t('simulation.getSimulation')}
                  onClick={() => launchStdcmRequest()}
                />
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
    </div>
  );
};

export default StdcmViewV2;
