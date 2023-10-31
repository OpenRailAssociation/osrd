import React, { useMemo } from 'react';
import { Map } from 'maplibre-gl';
import { useSelector } from 'react-redux';
import { Marker } from 'react-map-gl/maplibre';
import originSVG from 'assets/pictures/origin.svg';
import destinationSVG from 'assets/pictures/destination.svg';
import viaSVG from 'assets/pictures/via.svg';
import { getNearestTrack } from 'utils/mapHelper';
import { PointOnMap } from 'applications/operationalStudies/consts';
import { Position } from '@turf/helpers';
import { useOsrdConfSelectors } from 'common/osrdContext';

enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}

type MarkerInformation = {
  coordinates: number[] | Position;
  name: string | null | JSX.Element;
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

const formatPointWithNoName = (lineCode: number, lineName: string, trackName: string) => (
  <>
    <div className="main-line">
      <div className="track-name">{trackName}</div>
      <div className="line-code">{lineCode}</div>
    </div>
    <div className="second-line">{lineName}</div>
  </>
);

const getMarkerName = (marker: PointOnMap, coordinates: number[] | Position, map: Map) => {
  if (marker.name) return marker.name;
  let {
    extensions_sncf_line_code: lineCode,
    extensions_sncf_line_name: lineName,
    extensions_sncf_track_name: trackName,
  } = marker;
  if (!lineCode || !lineName || !trackName) {
    const trackResult = getNearestTrack(coordinates, map);
    if (trackResult) {
      const { track } = trackResult;
      if (track && track.properties) {
        if (track.properties.extensions_sncf_line_code)
          lineCode = track.properties.extensions_sncf_line_code;
        if (track.properties.extensions_sncf_line_name)
          lineName = track.properties.extensions_sncf_line_name;
        if (track.properties.extensions_sncf_track_name)
          trackName = track.properties.extensions_sncf_track_name;
      }
    }
  }
  if (lineCode && lineName && trackName)
    return formatPointWithNoName(lineCode, lineName, trackName);
  return null;
};

const ItineraryMarkers = ({ map }: { map: Map }) => {
  const { getVias, getOrigin, getDestination } = useOsrdConfSelectors();
  const vias = useSelector(getVias);
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);

  const markersInformation = useMemo(() => {
    const result = [] as MarkerInformation[];
    if (origin && origin.coordinates) {
      result.push({
        coordinates: origin.coordinates,
        type: MARKER_TYPE.ORIGIN,
        name: getMarkerName(origin, origin.coordinates, map),
        imageSource: originSVG,
      });
    }
    vias.forEach((via, index) => {
      if (via.coordinates)
        result.push({
          coordinates: via.coordinates,
          type: MARKER_TYPE.VIA,
          name: getMarkerName(via, via.coordinates, map),
          imageSource: viaSVG,
          index,
        });
    });
    if (destination && destination.coordinates) {
      result.push({
        coordinates: destination.coordinates,
        type: MARKER_TYPE.DESTINATION,
        name: getMarkerName(destination, destination.coordinates, map),
        imageSource: destinationSVG,
      });
    }
    return result;
  }, [origin, vias, destination, map]);

  const Markers = useMemo(
    () =>
      markersInformation.map((marker) => {
        const isDestination = marker.type === MARKER_TYPE.DESTINATION;
        const isVia = marker.type === MARKER_TYPE.VIA;
        return (
          <Marker
            longitude={marker.coordinates[0]}
            latitude={marker.coordinates[1]}
            offset={isDestination ? [0, -24] : [0, -12]}
            key={isVia ? `via-${marker.index}` : marker.type}
          >
            <img
              src={marker.imageSource}
              alt={marker.type}
              style={{ height: isDestination ? '3rem' : '1.5rem' }}
            />
            {isVia && <span className="map-pathfinding-marker via-number">{marker.index + 1}</span>}
            {marker.name && (
              <div className={`map-pathfinding-marker ${marker.type}-name`}>{marker.name}</div>
            )}
          </Marker>
        );
      }),
    [markersInformation]
  );

  return Markers;
};

export default ItineraryMarkers;
