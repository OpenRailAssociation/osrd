import React, { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { WebMercatorViewport } from 'viewport-mercator-project';
import { Dispatch } from 'redux';
import DisplayItinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';
import {
  withStdcmData as withModalSuggeredViasStdcmData,
  withOSRDSimulationData as withModalSuggeredViasOSRData,
} from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';
import { ValueOf } from 'utils/types';
// All of these should come from proper Stdcm Context
import { updateFeatureInfoClick } from 'reducers/map';
import { updateViewport } from 'reducers/map';
//import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getOrigin, getDestination, getVias, getInfraID } from 'reducers/osrdconf/selectors';
import {
  getOrigin as getOriginStdcm,
  getDestination as getDestinationStdcm,
  getVias as getViasStdcm,
  getInfraID as getInfraIDStdcm,
} from 'reducers/osrdStdcmConf/selectors';
import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';
import {
  replaceVias as replaceViasStdcm,
  updateDestination as updateDestinationStdcm,
  updateOrigin as updateOriginStdcm,
} from 'reducers/osrdStdcmConf';

import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { OsrdConfState, PointOnMap } from 'applications/operationalStudies/consts';
import { getViewport } from 'reducers/map/selectors';
import { MapState } from 'reducers/map';
import { reducer, init } from 'common/Pathfinding/Pathfinding';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { MODES, STDCM_MODES } from 'applications/operationalStudies/consts';

const StdcmSuggeredVias = withModalSuggeredViasStdcmData(ModalSugerredVias);
const SimulationSuggeredVias = withModalSuggeredViasOSRData(ModalSugerredVias);
interface ItineraryProps {
  dispatchUpdateExtViewPort?: (viewPort: any) => Dispatch;
  dispatchUpdateFeatureInfoClick?: (id: number, source: any) => Dispatch;
  dispatchReplaceVias?: (vias: PointOnMap[]) => Dispatch;
  dispatchUpdateOrigin?: (origin: any) => Dispatch;
  dispatchUpdateDestination?: (destination: any) => Dispatch;
  pathfindingState?: any;
  origin?: OsrdConfState['origin'];
  infra?: OsrdConfState['infraID'];
  destination?: OsrdConfState['destination'];
  vias?: OsrdConfState['vias'];
  mapViewPort?: MapState['viewport'];
  mode?: ValueOf<typeof MODES>;
}

export function withStdcmData<T extends ItineraryProps>(Component: ComponentType<T>) {
  return (hocProps: Omit<T, 'mode'>) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const dispatch = useDispatch();
    const origin = useSelector(getOriginStdcm);
    const destination = useSelector(getDestinationStdcm);
    const vias = useSelector(getViasStdcm);
    const infra = useSelector(getInfraIDStdcm);
    const mapViewPort = useSelector(getViewport);
    const [, pathfindingState] = osrdMiddlewareApi.usePostPathfindingMutation();
    const mode = MODES.stdcm;

    const modalSuggeredVias = withModalSuggeredViasStdcmData(ModalSugerredVias);

    const dispatchReplaceVias = (newVias: any[]) => {
      dispatch(replaceViasStdcm(newVias));
    };

    const dispatchUpdateExtViewPort = (viewPort: any) => {
      dispatch(
        updateViewport({
          ...viewPort,
        })
      );
    };

    const dispatchUpdateDestination = (newPosition: any) => {
      dispatch(updateDestinationStdcm(newPosition));
    };

    const dispatchUpdateOrigin = (newPosition: any) => {
      dispatch(updateOriginStdcm(newPosition));
    };

    const dispatchUpdateFeatureInfoClick = (id: number, source: any) => {
      dispatch(updateFeatureInfoClick(id, source));
    };

    return (
      <Component
        {...(hocProps as T)}
        dispatchUpdateFeatureInfoClick={dispatchUpdateFeatureInfoClick}
        dispatchUpdateExtViewPort={dispatchUpdateExtViewPort}
        dispatchReplaceVias={dispatchReplaceVias}
        dispatchUpdateOrigin={dispatchUpdateOrigin}
        dispatchUpdateDestination={dispatchUpdateDestination}
        origin={origin}
        destination={destination}
        vias={vias}
        infra={infra}
        mapViewPort={mapViewPort}
        pathfindingState={pathfindingState}
        mode={mode}
       
      />
    );
  };
}

export function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const dispatch = useDispatch();
    const origin = useSelector(getOrigin);
    const destination = useSelector(getDestination);
    const vias = useSelector(getVias);
    const infra = useSelector(getInfraID);
    const mapViewPort = useSelector(getViewport);
    const [, pathfindingState] = osrdMiddlewareApi.usePostPathfindingMutation();
    const mode = MODES.simulation;

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
        dispatchUpdateExtViewPort={dispatchUpdateExtViewPort}
        dispatchReplaceVias={dispatchReplaceVias}
        dispatchUpdateOrigin={dispatchUpdateOrigin}
        dispatchUpdateDestination={dispatchUpdateDestination}
        origin={origin}
        destination={destination}
        mode={mode}
        vias={vias}
        infra={infra}
        mapViewPort={mapViewPort}
        pathfindingState={pathfindingState}
      />
    );
  };
}

function Itinerary(props: ItineraryProps) {
  const {
    dispatchUpdateExtViewPort = () => null,
    dispatchUpdateFeatureInfoClick = () => null,
    dispatchReplaceVias = () => null,
    dispatchUpdateOrigin = () => null,
    dispatchUpdateDestination = () => null,
    mapViewPort = {},
    infra,
    origin,
    destination,
    mode = MODES.simulation,
    vias = [],
  } = props;

  const zoomToFeature = (boundingBox: number[], id = undefined, source = undefined) => {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;

    const viewport = new WebMercatorViewport({ ...mapViewPort, width: 600, height: 400 });

    const { longitude, latitude, zoom } = viewport.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 40,
      }
    );
    const newViewport = {
      ...mapViewPort,
      longitude,
      latitude,
      zoom,
    };
    dispatchUpdateExtViewPort(newViewport);
    if (id !== undefined && source !== undefined) {
      dispatchUpdateFeatureInfoClick(Number(id), source);
    }
  };

  const zoomToFeaturePoint = (
    lngLat: any,
    id: string | undefined = undefined,
    source: string | undefined = undefined
  ) => {
    if (lngLat) {
      const newViewport = {
        ...mapViewPort,
        longitude: lngLat[0],
        latitude: lngLat[1],
        zoom: 16,
      };
      dispatchUpdateExtViewPort(newViewport);
      if (id !== undefined && source !== undefined) {
        dispatchUpdateFeatureInfoClick(Number(id), source);
      }
    }
  };

  const removeViaFromPath = (step: PointOnMap) => {
    dispatchReplaceVias(vias.filter((via) => via.track !== step.track));
  };

  const inverseOD = () => {
    if (origin && destination) {
      const newOrigin = { ...origin };
      dispatchUpdateOrigin(destination);
      dispatchUpdateDestination(newOrigin);
      if (vias && vias.length > 1) {
        const newVias = Array.from(vias);
        dispatchReplaceVias(newVias.reverse());
      }
    }
  };

  const removeAllVias = () => {
    dispatchReplaceVias([]);
  };

  const viaModalContent =
    mode === MODES.stdcm ? (
      <StdcmSuggeredVias
        pathfindingInProgress={false}
        inverseOD={inverseOD}
        removeAllVias={removeAllVias}
        removeViaFromPath={removeViaFromPath}
      />
    ) : (
      <SimulationSuggeredVias
        pathfindingInProgress={false}
        inverseOD={inverseOD}
        removeAllVias={removeAllVias}
        removeViaFromPath={removeViaFromPath}
      />
    );

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container" data-testid="itinerary">
        <DisplayItinerary
          {...props}
          data-testid="display-itinerary"
          zoomToFeaturePoint={zoomToFeaturePoint}
          zoomToFeature={zoomToFeature}
          viaModalContent={viaModalContent}
        />
      </div>
    </div>
  );
}

Itinerary.propTypes = {};

export default Itinerary;
