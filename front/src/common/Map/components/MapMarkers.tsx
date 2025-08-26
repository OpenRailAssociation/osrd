import cx from 'classnames';
import type { Position } from 'geojson';
import { Marker } from 'react-map-gl/maplibre';

import { MARKER_TYPE } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/ManageTimetableItemMap/ItineraryMarkers';
import destinationIcon from 'assets/pictures/mapMarkers/destination.svg';
import viaIcon from 'assets/pictures/mapMarkers/intermediate-point.svg';
import originIcon from 'assets/pictures/mapMarkers/start.svg';

const MARKER_OFFSET: [number, number] = [0, 8];

export type MapMarker = {
  coordinates: Position;
  pointType: MARKER_TYPE;
};

type MapMarkersProps = {
  markers: MapMarker[];
};

const MapMarkers = ({ markers }: MapMarkersProps) =>
  markers.map(({ coordinates, pointType }, index) => {
    const viaNumber = markers[0].pointType === MARKER_TYPE.VIA ? index + 1 : index;
    let imgSrc = viaIcon;
    let imgAlt = `via ${viaNumber}`;

    if (pointType === MARKER_TYPE.ORIGIN) {
      imgSrc = originIcon;
      imgAlt = 'origin';
    } else if (pointType === MARKER_TYPE.DESTINATION) {
      imgSrc = destinationIcon;
      imgAlt = 'destination';
    }

    return (
      <Marker
        longitude={coordinates[0]}
        latitude={coordinates[1]}
        anchor="bottom"
        offset={MARKER_OFFSET}
        key={index}
      >
        <img src={imgSrc} alt={imgAlt} />
        {pointType === MARKER_TYPE.VIA && (
          <span className={cx('map-pathfinding-marker', 'via-number', 'stdcm-via')}>
            {viaNumber}
          </span>
        )}
      </Marker>
    );
  });

export default MapMarkers;
