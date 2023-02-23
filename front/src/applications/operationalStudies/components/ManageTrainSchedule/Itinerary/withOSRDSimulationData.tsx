import React, { ComponentType, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get, patch } from 'common/requests';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getOrigin, getDestination, getVias, getInfraID } from 'reducers/osrdconf/selectors';

import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import Itinerary from './Itinerary';

// All of these should come from proper Stdcm Context
import { updateFeatureInfoClick } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';

// Initialy try to implement https://react-typescript-cheatsheet.netlify.app/docs/hoc/, no success

function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const origin = useSelector(getOrigin);
    const destination = useSelector(getDestination);
    const vias = useSelector(getVias);
    const infra = useSelector(getInfraID);
    const map = useSelector((state: any) => state.map);

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
      />
    );
  };
}

export default withOSRDSimulationData(Itinerary);
