import { useContext } from 'react';

import along from '@turf/along';
import length from '@turf/length';
import type { Feature, Point } from 'geojson';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EditorContext from 'applications/editor/context';
import {
  TRACK_COLOR,
  TRACK_STYLE,
} from 'applications/editor/tools/trackEdition/components/TrackEditionLayers';
import { TRACK_LAYER_ID, POINTS_LAYER_ID } from 'applications/editor/tools/trackEdition/consts';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { GeoJSONs } from 'common/Map/Layers';
import { colors } from 'common/Map/theme';
import { useInfraID } from 'common/osrdContext';
import { useMapSettings } from 'reducers/commonMap';
import { getEditorState } from 'reducers/editor/selectors';

import type { TrackSplitState } from '../types';
import { isOffsetValid } from '../utils';

function getSplitPoint(state: TrackSplitState): Feature<Point> {
  let splitOffset = state.offset;
  if (state.splitState.type === 'movePoint') {
    splitOffset = state.splitState.offset;
  }

  const editoastOffset = isOffsetValid(splitOffset, state.track)
    ? splitOffset
    : (state.track.properties.length * 1000) / 2;

  const frontOffset =
    (editoastOffset / (state.track.properties.length * 1000)) *
    length(state.track, { units: 'millimeters' });

  return along(state.track.geometry, frontOffset, { units: 'millimeters' });
}

const TrackSplitLayers = () => {
  const {
    mapSettings: { layersSettings },
    issuesSettings,
  } = useSelector(getEditorState);
  const { mapStyle } = useMapSettings();
  const infraID = useInfraID();
  const {
    state,
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<TrackSplitState>;

  const splitPoint = getSplitPoint(state);

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={state.track.properties.id ? [state.track.properties.id] : undefined}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
      />

      {/* Track path */}
      <Source type="geojson" data={state.track}>
        <Layer id={TRACK_LAYER_ID} type="line" paint={TRACK_STYLE} />
      </Source>

      {/* Highlighted split point of the track section */}
      <Source type="geojson" data={splitPoint}>
        <Layer
          id={POINTS_LAYER_ID}
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': '#fff',
            'circle-stroke-color': TRACK_COLOR,
            'circle-stroke-width': 3,
          }}
        />
      </Source>
    </>
  );
};

export default TrackSplitLayers;
