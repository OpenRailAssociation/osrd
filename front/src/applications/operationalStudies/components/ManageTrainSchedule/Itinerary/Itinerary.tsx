import React, { ComponentType, useReducer } from 'react';
import PropTypes from 'prop-types';
import { WebMercatorViewport } from 'viewport-mercator-project';
import { Dispatch } from 'redux';
import DisplayItinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayItinerary';
import ModalSugerredVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/ModalSuggeredVias';

// All of these should come from proper Stdcm Context
import { updateFeatureInfoClick } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getOrigin, getDestination, getVias, getInfraID } from 'reducers/osrdconf/selectors';
import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';

import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { OsrdConfState, PointOnMap } from 'applications/operationalStudies/consts';
import { getViewport } from 'reducers/map/selectors';
import { MapState } from 'reducers/map';
import { reducer, init } from 'common/Pathfinding/Pathfinding';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';

interface ItineraryProps {
  dispatchUpdateExtViewPort: (viewPort: any) => Dispatch;
  dispatchUpdateFeatureInfoClick: (id: number, source: any) => Dispatch;
  dispatchReplaceVias: (vias: PointOnMap[]) => Dispatch;
  dispatchUpdateOrigin: (origin: any) => Dispatch;
  dispatchUpdateDestination: (destination: any) => Dispatch;
  pathfindingState: any;
  origin: OsrdConfState['origin'];
  infra: OsrdConfState['infraID'];
  destination: OsrdConfState['destination'];
  vias?: OsrdConfState['vias'];
  mapViewPort: MapState['viewport'];
}

export function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const origin = useSelector(getOrigin);
    const destination = useSelector(getDestination);
    const vias = useSelector(getVias);
    const infra = useSelector(getInfraID);
    const mapViewPort = useSelector(getViewport);
    const [, pathfindingState] = osrdMiddlewareApi.usePostPathfindingMutation();
    //const [pathfindingState, pathfindingDispatch] = useReducer(reducer, initializerArgs, init);

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
    dispatchUpdateExtViewPort,
    dispatchUpdateFeatureInfoClick,
    dispatchReplaceVias,
    dispatchUpdateOrigin,
    dispatchUpdateDestination,
    mapViewPort,
    infra,
    origin,
    destination,
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

  const viaModalContent = (
    <ModalSugerredVias
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

Itinerary.propTypes = {
  updateExtViewport: PropTypes.func.isRequired,
};

export default Itinerary;
