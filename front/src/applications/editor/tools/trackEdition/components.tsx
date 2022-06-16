import React, { FC, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';

import { EditorContext, EditorContextType } from '../../context';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import { TrackEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import { TrackSectionEntity } from '../../../../types';
import { Feature, MultiPoint } from 'geojson';

export const TrackEditionLayers: FC = () => {
  const { state } = useContext(EditorContext) as EditorContextType<TrackEditionState>;
  const { mapStyle } = useSelector((s: { map: any }) => s.map) as { mapStyle: string };
  const points = state.track.geometry.coordinates.slice(0);

  if (state.editionState.type === 'addPoint' && state.mousePosition) {
    const lastPosition =
      state.anchorLinePoints && state.nearestPoint
        ? (state.nearestPoint.geometry.coordinates as [number, number])
        : state.mousePosition;
    if (state.editionState.addAtStart) {
      points.unshift(lastPosition);
    } else {
      points.push(lastPosition);
    }
  }

  return (
    <>
      {!!points.length && (
        <EditorZone
          newZone={{
            type: 'polygon',
            points,
          }}
        />
      )}
      <GeoJSONs colors={colors[mapStyle]} />

      {state.nearestPoint && (
        <Source type="geojson" data={state.nearestPoint}>
          <Layer
            type="circle"
            paint={{
              'circle-radius': 4,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#009EED',
              'circle-stroke-width': 1,
            }}
          />
        </Source>
      )}

      {state.editionState.type !== 'addPoint' && (
        <Source
          type="geojson"
          data={{
            type: 'Feature',
            geometry: {
              type: 'MultiPoint',
              coordinates: points,
            },
            properties: {},
          }}
        >
          <Layer
            type="circle"
            paint={{
              'circle-radius': 4,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#009EED',
              'circle-stroke-width': 1,
            }}
          />
        </Source>
      )}
    </>
  );
};

export const TrackEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState } = useContext(EditorContext) as EditorContextType<TrackEditionState>;

  return (
    <EditorForm
      data={state.track}
      onSubmit={async (savedEntity) => {
        await dispatch<any>(save({ create: [savedEntity] }));
        setState({ ...state, track: savedEntity as TrackSectionEntity });
      }}
    >
      <div className="text-right">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={state.track.geometry.coordinates.length < 2}
        >
          {t('common.save')}
        </button>
      </div>
    </EditorForm>
  );
};
