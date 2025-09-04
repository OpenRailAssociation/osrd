import React, { useEffect, useState } from 'react';

import { point } from '@turf/helpers';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';
import { RiMapPin2Fill, RiMapPin3Fill } from 'react-icons/ri';
import { Popup } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import { v4 as uuidV4 } from 'uuid';

import { editoastToEditorEntity } from 'applications/editor/data/api';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { MapPathProperties } from 'applications/operationalStudies/types';
import { osrdEditoastApi, type OperationalPoint } from 'common/api/osrdEditoastApi';
import { getOrigin, getDestination } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep } from 'reducers/osrdconf/types';
import { getPointOnTrackCoordinates } from 'utils/geometry';

import type { FeatureInfoClick } from '../types';
import OperationalPointPopupDetails from './OperationalPointPopupDetails';
import { setPointIti } from './setPointIti';

type AddPathStepPopupProps = {
  infraId: number | undefined;
  pathProperties?: MapPathProperties;
  featureInfoClick: FeatureInfoClick;
  resetFeatureInfoClick: () => void;
};

const AddPathStepPopup = ({
  infraId,
  pathProperties,
  featureInfoClick,
  resetFeatureInfoClick,
}: AddPathStepPopupProps) => {
  const { launchPathfinding } = useManageTimetableItemContext();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);

  const { getTrackSectionsByIds } = useScenarioContext();

  const [clickedOp, setClickedOp] = useState<
    PathStep & {
      tracks: {
        trackName?: string;
        coordinates?: number[];
      }[];
    }
  >();
  const [selectedTrack, setSelectedTrack] = useState<{
    trackName?: string;
    coordinates?: number[];
  }>();
  const [newPathStep, setNewPathStep] = useState<PathStep>();

  const [getInfraObjectEntity] =
    osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.useLazyQuery();

  useEffect(() => {
    const handleTrack = async () => {
      const objectId = featureInfoClick.feature.properties?.id;

      const result = await getInfraObjectEntity({
        infraId: infraId!,
        objectType: 'TrackSection',
        body: [objectId],
      }).unwrap();

      if (!result.length) {
        console.error('No track found');
        return;
      }

      const trackEntity = editoastToEditorEntity<TrackSectionEntity>(result[0], 'TrackSection');
      const offset = calculateDistanceAlongTrack(
        trackEntity,
        point(featureInfoClick.coordinates.slice(0, 2)).geometry,
        'millimeters'
      );

      if (!featureInfoClick.feature.properties) return;

      const { properties } = featureInfoClick.feature;
      setNewPathStep({
        id: uuidV4(),
        coordinates: featureInfoClick.coordinates.slice(0, 2),
        location: {
          track: properties.id,
          offset: Math.round(offset),
        },
        kp: properties.kp,
        metadata: {
          lineCode: properties.extensions_sncf_line_code,
          lineName: properties.extensions_sncf_line_name,
          trackName: properties.extensions_sncf_track_name,
          trackNumber: properties.extensions_sncf_track_number,
        },
      });
    };

    const handleOperationalPoint = async () => {
      const objectId = featureInfoClick.feature.properties?.id;

      const result = await getInfraObjectEntity({
        infraId: infraId!,
        objectType: 'OperationalPoint',
        body: [objectId],
      }).unwrap();

      if (!result.length) {
        console.error('No operational point found');
        return;
      }

      const operationalPoint = result[0].railjson as OperationalPoint;
      const trackIds = operationalPoint.parts.map((part) => part.track);
      const tracks = await getTrackSectionsByIds(trackIds);

      const trackPartCoordinates = operationalPoint.parts.map((part) => ({
        trackName: tracks[part.track]?.extensions?.sncf?.track_name,
        coordinates: getPointOnTrackCoordinates(
          tracks[part.track]?.geo,
          tracks[part.track]?.length,
          part.position
        ),
      }));

      trackPartCoordinates.unshift({
        trackName: undefined,
        coordinates: result[0].geographic.coordinates as number[],
      });

      setClickedOp({
        id: uuidV4(),
        location: {
          secondary_code: operationalPoint.extensions!.sncf!.ch,
          uic: operationalPoint.extensions!.identifier!.uic,
        },
        tracks: trackPartCoordinates,
      });
      setSelectedTrack(trackPartCoordinates[0]);
    };

    setClickedOp(undefined);

    if (featureInfoClick.isOperationalPoint) {
      handleOperationalPoint();
    } else {
      handleTrack();
    }
  }, [featureInfoClick]);

  useEffect(() => {
    if (!clickedOp || !selectedTrack) {
      setNewPathStep(undefined);
      return;
    }

    const { tracks: _tracks, location: prevLocation, ...opWithoutTracks } = clickedOp;
    setNewPathStep({
      ...opWithoutTracks,
      coordinates: selectedTrack.coordinates,
      location: {
        ...prevLocation,
        track_reference: selectedTrack.trackName
          ? { track_name: selectedTrack.trackName }
          : undefined,
      },
    });
  }, [clickedOp, selectedTrack]);

  if (
    !newPathStep ||
    !featureInfoClick.feature.properties ||
    (featureInfoClick.isOperationalPoint && !clickedOp)
  )
    return null;

  const coordinates = featureInfoClick.coordinates.slice(0, 2);

  return (
    <Popup
      longitude={coordinates[0]}
      latitude={coordinates[1]}
      closeButton={false}
      closeOnClick={false}
      className="map-popup-click-select"
    >
      {featureInfoClick.isOperationalPoint ? (
        <OperationalPointPopupDetails
          operationalPoint={featureInfoClick}
          clickedOp={clickedOp!}
          selectedTrack={selectedTrack!}
          setSelectedTrack={setSelectedTrack}
        />
      ) : (
        <div className="details">
          <div className="details-track">
            {featureInfoClick.feature.properties.extensions_sncf_track_name}
            <small>{featureInfoClick.feature.properties.extensions_sncf_line_code}</small>
          </div>
          <div className="details-line">
            {featureInfoClick.feature.properties.extensions_sncf_line_name}
          </div>
        </div>
      )}

      <div className="actions">
        <button
          className="btn btn-sm btn-success"
          type="button"
          onClick={() => {
            setPointIti('origin', newPathStep, launchPathfinding, resetFeatureInfoClick);
          }}
        >
          <RiMapPin2Fill />
          <span className="d-none">{t('origin')}</span>
        </button>
        {origin && destination && (
          <button
            className="btn btn-sm btn-info"
            type="button"
            onClick={() => {
              setPointIti(
                'via',
                newPathStep,
                launchPathfinding,
                resetFeatureInfoClick,
                pathProperties
              );
            }}
          >
            <RiMapPin3Fill />
            <span className="d-none">{t('via')}</span>
          </button>
        )}
        <button
          className="btn btn-sm btn-warning"
          type="button"
          onClick={() => {
            setPointIti('destination', newPathStep, launchPathfinding, resetFeatureInfoClick);
          }}
        >
          <IoFlag />
          <span className="d-none">{t('destination')}</span>
        </button>
      </div>
    </Popup>
  );
};

export default React.memo(AddPathStepPopup);
