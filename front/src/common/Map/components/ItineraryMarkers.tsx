import { useCallback, useEffect, useMemo, useState } from 'react';

import cx from 'classnames';
import type { Position } from 'geojson';
import { Marker } from 'react-map-gl/maplibre';

import useCachedTrackSections from 'applications/operationalStudies/hooks/useCachedTrackSections';
import destinationSVG from 'assets/pictures/destination.svg';
import stdcmDestination from 'assets/pictures/mapMarkers/destination.svg';
import stdcmVia from 'assets/pictures/mapMarkers/intermediate-point.svg';
import stdcmOrigin from 'assets/pictures/mapMarkers/start.svg';
import originSVG from 'assets/pictures/origin.svg';
import viaSVG from 'assets/pictures/via.svg';
import type { PathItemLocation, TrackSection } from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { PathStep } from 'reducers/osrdconf/types';

export type MarkerInformation = Pick<PathStep, 'name' | 'coordinates' | 'metadata'> & {
  pointType: MARKER_TYPE;
  location: PathItemLocation;
};

export enum MARKER_TYPE {
  ORIGIN = 'origin',
  VIA = 'via',
  DESTINATION = 'destination',
}

type MarkerProperties = {
  op?: SuggestedOP;
  pathStep: MarkerInformation;
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
  simulationPathSteps: MarkerInformation[];
  pathStepsAndSuggestedOPs?: SuggestedOP[];
  showStdcmAssets?: boolean;
  infraId: number;
};

const formatPointWithNoName = (
  lineCode: number,
  lineName: string,
  trackName: string,
  markerType: MarkerProperties['type']
) => (
  <>
    <div className="main-line">
      <div className="track-name">{trackName}</div>
      <div className="line-code">{lineCode}</div>
    </div>
    <div className={cx('second-line', { via: markerType === MARKER_TYPE.VIA })}>{lineName}</div>
  </>
);

const MARKER_IMAGES = {
  [MARKER_TYPE.ORIGIN]: originSVG,
  [MARKER_TYPE.DESTINATION]: destinationSVG,
  [MARKER_TYPE.VIA]: viaSVG,
};

const STDCM_MARKER_IMAGES = {
  [MARKER_TYPE.ORIGIN]: stdcmOrigin,
  [MARKER_TYPE.DESTINATION]: stdcmDestination,
  [MARKER_TYPE.VIA]: stdcmVia,
};

const extractMarkerInformation = (
  pathSteps: MarkerInformation[],
  showStdcmAssets: boolean,
  suggestedOP?: SuggestedOP[]
): MarkerProperties[] =>
  pathSteps
    .map((pathStep, index): MarkerProperties | null => {
      if (!pathStep.coordinates) return null;

      const matchingOp = suggestedOP
        ? suggestedOP.find((op) => matchPathStepAndOp(pathStep.location, op))
        : undefined;

      const images = showStdcmAssets ? STDCM_MARKER_IMAGES : MARKER_IMAGES;
      return {
        coordinates: pathStep.coordinates,
        imageSource: images[pathStep.pointType],
        op: matchingOp,
        pathStep,
        ...(pathStep.pointType === MARKER_TYPE.VIA
          ? {
              type: MARKER_TYPE.VIA,
              index,
            }
          : { type: pathStep.pointType }),
      };
    })
    .filter((marker): marker is MarkerProperties => marker !== null);

const ItineraryMarkers = ({
  simulationPathSteps,
  pathStepsAndSuggestedOPs,
  showStdcmAssets = false,
  infraId,
}: ItineraryMarkersProps) => {
  const { getTrackSectionsByIds } = useCachedTrackSections(infraId);

  const markersInformation = useMemo(
    () => extractMarkerInformation(simulationPathSteps, showStdcmAssets, pathStepsAndSuggestedOPs),
    [simulationPathSteps, showStdcmAssets, pathStepsAndSuggestedOPs]
  );

  const [trackSections, setTrackSections] = useState<Record<string, TrackSection>>({});

  useEffect(() => {
    const fetchTrackSections = async () => {
      const trackIds = markersInformation
        .map((markerInfo) => markerInfo.op?.track)
        .filter((trackId) => trackId !== undefined);
      setTrackSections(await getTrackSectionsByIds(trackIds));
    };

    if (pathStepsAndSuggestedOPs) fetchTrackSections();
  }, [markersInformation, pathStepsAndSuggestedOPs]);

  const getMarkerDisplayInformation = useCallback((markerInfo: MarkerProperties) => {
    const {
      pathStep: { metadata: markerMetadata, name: markerName },
      type: markerType,
    } = markerInfo;

    if (markerName) return markerName;
    if (!markerMetadata) return null;

    const {
      lineCode: markerLineCode,
      lineName: markerLineName,
      trackName: markerTrackName,
    } = markerMetadata;

    return formatPointWithNoName(markerLineCode, markerLineName, markerTrackName, markerType);
  }, []);

  return markersInformation.map((markerInfo) => {
    const isDestination = markerInfo.type === MARKER_TYPE.DESTINATION;
    const isVia = markerInfo.type === MARKER_TYPE.VIA;

    if (!markerInfo.pathStep.metadata && markerInfo.op) {
      const { op } = markerInfo;
      const trackId = op.track;
      const trackSection = trackSections[trackId];

      const metadataFromSuggestedOp = trackSection?.extensions?.sncf;

      if (!metadataFromSuggestedOp) return null;

      const {
        line_code: markerLineCode,
        line_name: markerLineName,
        track_name: markerTrackName,
        track_number: markerTrackNumber,
      } = metadataFromSuggestedOp;

      markerInfo.pathStep = {
        ...markerInfo.pathStep,
        metadata: {
          lineCode: markerLineCode,
          lineName: markerLineName,
          trackName: markerTrackName,
          trackNumber: markerTrackNumber,
        },
      };
    }

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
            {markersInformation[0].type === MARKER_TYPE.ORIGIN
              ? markerInfo.index
              : markerInfo.index + 1}
          </span>
        )}
        {!showStdcmAssets && markerInfo.pathStep.metadata && (
          <div className={`map-pathfinding-marker ${markerInfo.type}-name`}>
            {getMarkerDisplayInformation(markerInfo)}
          </div>
        )}
      </Marker>
    );
  });
};

export default ItineraryMarkers;
