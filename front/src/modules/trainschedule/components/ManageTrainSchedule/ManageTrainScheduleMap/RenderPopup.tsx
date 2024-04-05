/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';

import { point } from '@turf/helpers';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';
import { RiMapPin2Fill, RiMapPin3Fill } from 'react-icons/ri';
import nextId from 'react-id-generator';
import { Popup } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { editoastToEditorEntity } from 'applications/editor/data/api';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import {
  setPointIti,
  setPointItiV2,
} from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/setPointIti';
import type { PathStep } from 'reducers/osrdconf/types';
import { getTrainScheduleV2Activated } from 'reducers/user/userSelectors';

type FeatureInfoClickType = {
  displayPopup: boolean;
  coordinates?: number[];
  feature?: any;
};

type RenderPopupProps = {
  pathProperties?: ManageTrainSchedulePathProperties;
};

function RenderPopup({ pathProperties }: RenderPopupProps) {
  const { getFeatureInfoClick, getInfraID } = useOsrdConfSelectors();
  const osrdConfActions = useOsrdConfActions();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const featureInfoClick: FeatureInfoClickType = useSelector(getFeatureInfoClick);
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const infraId = useSelector(getInfraID);

  const [trackOffset, setTrackOffset] = useState(0);

  const [getTrackEntity] =
    osrdEditoastApi.endpoints.postInfraByIdObjectsAndObjectType.useMutation();

  useEffect(() => {
    const calculateOffset = async () => {
      if (
        !featureInfoClick.feature ||
        !featureInfoClick.feature.properties ||
        !featureInfoClick.coordinates
      )
        return;
      const trackId = featureInfoClick.feature.properties.id;
      const result = await getTrackEntity({
        id: infraId!,
        objectType: 'TrackSection',
        body: [trackId],
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
      setTrackOffset(offset);
    };

    if (trainScheduleV2Activated && featureInfoClick.displayPopup) {
      calculateOffset();
    }
  }, [featureInfoClick]);

  if (
    !featureInfoClick.displayPopup ||
    !featureInfoClick.feature ||
    !featureInfoClick.feature.properties ||
    !featureInfoClick.coordinates
  )
    return null;

  const properties = {
    ...featureInfoClick.feature.properties,
    coordinates: featureInfoClick.coordinates.slice(0, 2),
  };

  // TS2 section
  // TODO TS2: if !pathProperties, return null
  const { properties: trackProperties } = featureInfoClick.feature;
  const coordinates = featureInfoClick.coordinates.slice(0, 2);

  const pathStepProperties: PathStep = {
    id: nextId(),
    coordinates,
    track: trackProperties.id,
    offset: Math.round(trackOffset), // offset needs to be an integer
    kp: trackProperties.kp,
    metadata: {
      lineCode: trackProperties.extensions_sncf_line_code,
      lineName: trackProperties.extensions_sncf_line_name,
      trackName: trackProperties.extensions_sncf_track_name,
      trackNumber: trackProperties.extensions_sncf_track_number,
    },
  };

  return (
    <Popup
      longitude={featureInfoClick.coordinates[0]}
      latitude={featureInfoClick.coordinates[1]}
      closeButton={false}
      closeOnClick={false}
      className="map-popup-click-select"
    >
      <div className="details">
        <div className="details-track">
          {featureInfoClick.feature.properties.extensions_sncf_track_name}
          <small>{featureInfoClick.feature.properties.extensions_sncf_line_code}</small>
        </div>
        <div className="details-line">
          {featureInfoClick.feature.properties.extensions_sncf_line_name}
        </div>
      </div>
      {trainScheduleV2Activated ? (
        <div className="actions">
          <button
            data-testid="map-origin-button"
            className="btn btn-sm btn-success"
            type="button"
            onClick={() => setPointItiV2('origin', pathStepProperties, osrdConfActions)}
          >
            <RiMapPin2Fill />
            <span className="d-none">{t('origin')}</span>
          </button>
          <button
            className="btn btn-sm btn-info"
            type="button"
            onClick={() =>
              setPointItiV2('via', pathStepProperties, osrdConfActions, pathProperties)
            }
          >
            <RiMapPin3Fill />
            <span className="d-none">{t('via')}</span>
          </button>
          <button
            data-testid="map-destination-button"
            className="btn btn-sm btn-warning"
            type="button"
            onClick={() => setPointItiV2('destination', pathStepProperties, osrdConfActions)}
          >
            <IoFlag />
            <span className="d-none">{t('destination')}</span>
          </button>
        </div>
      ) : (
        <div className="actions">
          <button
            data-testid="map-origin-button"
            className="btn btn-sm btn-success"
            type="button"
            onClick={() => setPointIti('start', properties, osrdConfActions)}
          >
            <RiMapPin2Fill />
            <span className="d-none">{t('origin')}</span>
          </button>
          <button
            className="btn btn-sm btn-info"
            type="button"
            onClick={() => setPointIti('via', properties, osrdConfActions)}
          >
            <RiMapPin3Fill />
            <span className="d-none">{t('via')}</span>
          </button>
          <button
            data-testid="map-destination-button"
            className="btn btn-sm btn-warning"
            type="button"
            onClick={() => setPointIti('end', properties, osrdConfActions)}
          >
            <IoFlag />
            <span className="d-none">{t('destination')}</span>
          </button>
        </div>
      )}
    </Popup>
  );
}

export default React.memo(RenderPopup);
