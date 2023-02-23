import React, { ComponentType, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get, patch } from 'common/requests';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';

import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import DisplayIntinerary from './index';

// All of these should come from proper Stdcm Context
import { updateFeatureInfoClick } from 'reducers/map';
import { updateViewport } from 'reducers/map';

import {
  updateOrigin,
  updateOriginDate,
  updateOriginTime,
  updateOriginUpperBoundDate,
  updateOriginUpperBoundTime,
  updateOriginSpeed,
  updateStdcmMode,
  toggleOriginLinkedBounds,
} from 'reducers/osrdconf';

import {
  getStdcmMode,
  getMode,
  getOrigin,
  getOriginDate,
  getOriginTime,
  getOriginSpeed,
  getOriginLinkedBounds,
  getOriginUpperBoundDate,
  getOriginUpperBoundTime,
} from 'reducers/osrdconf/selectors';

// We use this HOC to pass only props needed by DisplayIntinerary subComponents(Vias, Origin, Destination, Pathfinding). Us a composition from the container
// Props for Display Intinerary itself are provided by Itinerary, even if it is formaly isolated.

function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const dispatch = useDispatch();
    const stdcmMode = useSelector(getStdcmMode);
    const mode = useSelector(getMode);
    const origin = useSelector(getOrigin);
    const originDate = useSelector(getOriginDate);
    const originTime = useSelector(getOriginTime);
    const originSpeed = useSelector(getOriginSpeed);
    const originLinkedBounds = useSelector(getOriginLinkedBounds);
    const originUpperBoundDate = useSelector(getOriginUpperBoundDate);
    const originUpperBoundTime = useSelector(getOriginUpperBoundTime);

    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    const [, setSyncInProgress] = useState(false);
    const [trainDetail, setTrainDetail] = useState<any>({ allowances: [] });

    const dispatchUpdatePositionValues = (newPositionValues: any) => {
      dispatch(updateDestination(newPositionValues));
    };

    const dispatchReplaceVias = (newVias: any[]) => {
      dispatch(replaceVias(newVias));
    };

    const dispatchUpdateExtViewPort = (viewPort: any) => {
      dispatch(
        updateViewport({
          ...viewPort,
        })
      );
    };

    const dispatchUpdateDestination = (newPosition: any) => {
      dispatch(updateDestination(newPosition));
    };

    const dispatchUpdateOrigin = (newPosition: any) => {
      dispatch(updateOrigin(newPosition));
    };

    const dispatchUpdateFeatureInfoClick = (id: number, source: any) => {
      dispatch(updateFeatureInfoClick(id, source));
    };

    return (
      <Component
        {...(hocProps as T)}
        dispatchUpdateFeatureInfoClick={dispatchUpdateFeatureInfoClick}
        dispatchUpdateExtViewport={dispatchUpdateExtViewPort}
        dispatchReplaceVias={dispatchReplaceVias}
        dispatchUpdateOrigin={dispatchUpdateOrigin}
        dispatchUpdateDestination={dispatchUpdateDestination}
        origin={origin}
        destination={destination}
        vias={vias}
        infra={infra}
        map={map}
        originDate={originDate}
        originTime={originTime}
        originSpeed={originSpeed}
        originLinkedBounds={originLinkedBounds}
        originUpperBoundDate={originUpperBoundDate}
        originUpperBoundTime={originUpperBoundTime}
      />
    );
  };
}

export default withOSRDSimulationData(DisplayIntinerary);
