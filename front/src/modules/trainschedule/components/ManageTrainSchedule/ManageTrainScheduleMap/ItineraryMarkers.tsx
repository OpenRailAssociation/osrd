import { useCallback, useMemo } from 'react';

import type { Position } from '@turf/helpers';
import cx from 'classnames';
import type { Map } from 'maplibre-gl';
import { Marker } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import destinationSVG from 'assets/pictures/destination.svg';
import originSVG from 'assets/pictures/origin.svg';
import stdcmDestination from 'assets/pictures/stdcmV2/destination.svg';
import stdcmVia from 'assets/pictures/stdcmV2/intermediate-point.svg';
import stdcmOrigin from 'assets/pictures/stdcmV2/start.svg';
import viaSVG from 'assets/pictures/via.svg';
import { useOsrdConfSelectors } from 'common/osrdContext';
import type { PathStep } from 'reducers/osrdconf/types';
import { getNearestTrack } from 'utils/mapHelper';
import { usePathfinding } from 'modules/pathfinding/hooks/usePathfinding';

enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}

type MarkerInformation = {
  marker: PathStep;
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

type ItineraryMarkersProps = {
  map: Map;
  simulationPathSteps?: PathStep[];
  showStdcmAssets: boolean;
};

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
  pathSteps: (PathStep | null)[],
  showStdcmAssets: boolean,
  invalidItems: string[] = []
) => {
  return pathSteps.reduce((acc, cur, index) => {
    if (cur && cur.coordinates && (!('trigram' in cur) || !invalidItems.includes(cur.trigram))) {
      if (index === 0) {
        acc.push({
          coordinates: cur.coordinates,
          type: MARKER_TYPE.ORIGIN,
          marker: cur,
          imageSource: showStdcmAssets ? stdcmOrigin : originSVG,
        });
      } else if (index > 0 && index < pathSteps.length - 1) {
        acc.push({
          coordinates: cur.coordinates,
          type: MARKER_TYPE.VIA,
          marker: cur,
          imageSource: showStdcmAssets ? stdcmVia : viaSVG,
          index: index,
        });
      } else if (index === pathSteps.length - 1) {
        acc.push({
          coordinates: cur.coordinates,
          type: MARKER_TYPE.DESTINATION,
          marker: cur,
          imageSource: showStdcmAssets ? stdcmDestination : destinationSVG,
        });
      }
    }
    return acc;
  }, [] as MarkerInformation[]);
};

const ItineraryMarkers = ({ map, simulationPathSteps, showStdcmAssets }: ItineraryMarkersProps) => {
  const { getPathSteps } = useOsrdConfSelectors();
  const pathSteps = useSelector(getPathSteps);
  const { invalidItems } = usePathfinding();

  const markersInformation = useMemo(
    () => extractMarkerInformation(simulationPathSteps || pathSteps, showStdcmAssets, invalidItems),
    [simulationPathSteps, pathSteps, showStdcmAssets, invalidItems]
  );

  const getMarkerDisplayInformation = useCallback(
    (markerInfo: MarkerInformation) => {
      const {
        marker: { coordinates: markerCoordinates, metadata: markerMetadata },
        type: markerType,
      } = markerInfo;

      if (markerMetadata) {
        const {
          lineCode: markerLineCode,
          lineName: markerLineName,
          trackName: markerTrackName,
        } = markerMetadata;
        return formatPointWithNoName(markerLineCode, markerLineName, markerTrackName, markerType);
      }

      if (!markerCoordinates) return null;

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
            offset={isDestination && !showStdcmAssets ? [0, -24] : [0, -12]}
            key={isVia ? `via-${markerInfo.index}` : markerInfo.type}
          >
            <img
              src={markerInfo.imageSource}
              alt={markerInfo.type}
              style={showStdcmAssets ? {} : { height: isDestination ? '3rem' : '1.5rem' }}
            />
            {isVia && (
              <span
                className={cx('map-pathfinding-marker', 'via-number', {
                  'stdcm-via': isVia && showStdcmAssets,
                })}
              >
                {markerInfo.index}
              </span>
            )}
            {!showStdcmAssets && markerName}
          </Marker>
        );
      }),
    [simulationPathSteps, pathSteps, showStdcmAssets, invalidItems]
  );
  return Markers;
};

export default ItineraryMarkers;
