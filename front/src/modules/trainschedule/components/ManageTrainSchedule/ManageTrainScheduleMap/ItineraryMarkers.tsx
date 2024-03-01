import type { Position } from '@turf/helpers';
import cx from 'classnames';
import React, { useCallback, useMemo } from 'react';
import type { Map } from 'maplibre-gl';
import { useSelector } from 'react-redux';
import { Marker } from 'react-map-gl/maplibre';

import originSVG from 'assets/pictures/origin.svg';
import destinationSVG from 'assets/pictures/destination.svg';
import viaSVG from 'assets/pictures/via.svg';

import type { PointOnMap } from 'applications/operationalStudies/consts';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { getNearestTrack } from 'utils/mapHelper';

enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}

type MarkerInformation = {
  marker: PointOnMap;
  coordinates: number[] | Position;
  imageSource: string;
} & (
  | {
      type: MARKER_TYPE.ORIGIN | MARKER_TYPE.DESTINATION;
    }
  | {
      type: MARKER_TYPE.VIA;
      index: number;
    }
);

const formatPointWithNoName = (
  lineCode: number,
  lineName: string,
  trackName: string,
  markerType: MarkerInformation['type']
) => (
  <>
    <div className="main-line">
      <div className="track-name">{trackName}</div>
      <div className="line-code">{lineCode}</div>
    </div>
    <div className={cx('second-line', { via: markerType === MARKER_TYPE.VIA })}>{lineName}</div>
  </>
);

const extractMarkerInformation = (
  origin: PointOnMap | undefined,
  vias: PointOnMap[],
  destination: PointOnMap | undefined
) => {
  const result = [] as MarkerInformation[];
  if (origin && origin.coordinates) {
    result.push({
      coordinates: origin.coordinates,
      type: MARKER_TYPE.ORIGIN,
      marker: origin,
      imageSource: originSVG,
    });
  }
  vias.forEach((via, index) => {
    if (via.coordinates)
      result.push({
        coordinates: via.coordinates,
        type: MARKER_TYPE.VIA,
        marker: via,
        imageSource: viaSVG,
        index,
      });
  });
  if (destination && destination.coordinates) {
    result.push({
      coordinates: destination.coordinates,
      type: MARKER_TYPE.DESTINATION,
      marker: destination,
      imageSource: destinationSVG,
    });
  }
  return result;
};

const ItineraryMarkers = ({ map }: { map: Map }) => {
  const { getVias, getOrigin, getDestination } = useOsrdConfSelectors();
  const vias = useSelector(getVias);
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);

  const markersInformation = useMemo(
    () => extractMarkerInformation(origin, vias, destination),
    [origin, vias, destination]
  );

  const getMarkerDisplayInformation = useCallback(
    (markerInfo: MarkerInformation) => {
      const {
        marker: {
          coordinates: markerCoordinates,
          extensions_sncf_line_code: markerLineCode,
          extensions_sncf_line_name: markerLineName,
          extensions_sncf_track_name: markerTrackName,
        },
        type: markerType,
      } = markerInfo;
      if (markerLineCode && markerLineName && markerTrackName)
        return formatPointWithNoName(markerLineCode, markerLineName, markerTrackName, markerType);

      if (markerCoordinates) {
        const trackResult = getNearestTrack(markerCoordinates, map);
        if (trackResult) {
          const {
            track: { properties: trackProperties },
          } = trackResult;
          if (trackProperties) {
            const {
              extensions_sncf_line_code: lineCode,
              extensions_sncf_line_name: lineName,
              extensions_sncf_track_name: trackName,
            } = trackProperties;
            if (lineCode && lineName && trackName)
              return formatPointWithNoName(lineCode, lineName, trackName, markerType);
          }
        }
      }

      return null;
    },
    [map]
  );

  const Markers = useMemo(
    () =>
      markersInformation.map((markerInfo) => {
        const isDestination = markerInfo.type === MARKER_TYPE.DESTINATION;
        const isVia = markerInfo.type === MARKER_TYPE.VIA;

        const markerName = (
          <div className={`map-pathfinding-marker ${markerInfo.type}-name`}>
            {markerInfo.marker.name
              ? markerInfo.marker.name
              : getMarkerDisplayInformation(markerInfo)}
          </div>
        );
        return (
          <Marker
            longitude={markerInfo.coordinates[0]}
            latitude={markerInfo.coordinates[1]}
            offset={isDestination ? [0, -24] : [0, -12]}
            key={isVia ? `via-${markerInfo.index}` : markerInfo.type}
          >
            <img
              src={markerInfo.imageSource}
              alt={markerInfo.type}
              style={{ height: isDestination ? '3rem' : '1.5rem' }}
            />
            {isVia && (
              <span className="map-pathfinding-marker via-number">{markerInfo.index + 1}</span>
            )}
            {markerName}
          </Marker>
        );
      }),
    [markersInformation]
  );

  return Markers;
};

export default ItineraryMarkers;
