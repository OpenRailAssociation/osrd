import React, { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { Position } from 'geojson';
import cx from 'classnames';
import { ValueOf } from 'utils/types';

import { useTranslation } from 'react-i18next';

import Pathfinding from 'common/Pathfinding';

import Origin, { OriginProps } from './Origin';
import Vias from './Vias';
import Destination, { DestinationProps } from './Destination';
import { MODES } from 'applications/operationalStudies/consts';
// Interfaces
import { PointOnMap } from 'applications/operationalStudies/consts';

// All the props are provided by container Itinerary if ehanced by the view. HOC only for standalone display
interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string | undefined, source?: string) => void;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  viaModalContent: string | JSX.Element; // pr
  origin?: PointOnMap;
  destination?: PointOnMap;
  vias?: PointOnMap[];
  destinationProps?: DestinationProps;
  originProps?: OriginProps;
  mode?: ValueOf<typeof MODES>;
}

// We use this HOC to pass only props needed by DisplayIntinerary subComponents(Vias, Origin, Destination, Pathfinding). Us a composition from the container
// Props for Display Intinerary itself are provided by Itinerary, even if it is formaly isolated.

export function withStdcmData<T extends DisplayItineraryProps>(Component: ComponentType<T>) {
  return (hocProps: DisplayItineraryProps) => {
    return <Component {...(hocProps as T)} />;
  };
}

export function withOSRDSimulationData<T extends DisplayItineraryProps>(
  Component: ComponentType<T>
) {
  return (hocProps: DisplayItineraryProps) => {
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    return <Component {...(hocProps as T)} t={t} />;
  };
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const {
    zoomToFeaturePoint,
    zoomToFeature,
    viaModalContent,
    origin,
    destination,
    vias = [],
    mode = MODES.simulation,
  } = props;

  return (
    <div
      className={cx({
        'osrd-config-anchor': !origin && !destination && vias.length < 1,
      })}
    >
      <Origin {...props} data-testid="itinerary-origin" zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias
        {...props}
        data-testid="itinerary-vias"
        zoomToFeaturePoint={zoomToFeaturePoint}
        viaModalContent={viaModalContent}
      />
      <Destination
        {...props}
        data-testid="itinerary-destination"
        zoomToFeaturePoint={zoomToFeaturePoint}
      />

      <Pathfinding zoomToFeature={zoomToFeature} mode={mode} />
    </div>
  );
}

DisplayItinerary.propTypes = {
  zoomToFeaturePoint: PropTypes.func,
  zoomToFeature: PropTypes.func,
  viaModalContent: PropTypes.object,
  origin: PropTypes.object,
  destination: PropTypes.object,
  vias: PropTypes.array,
};

DisplayItinerary.defaultProps = {
  zoomToFeaturePoint: () => {},
  zoomToFeature: () => {},
  viaModalContent: {},
  origin: {},
  destination: {},
  vias: [],
};
