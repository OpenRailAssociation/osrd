import { useContext } from 'react';

import { Layer, Popup, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';
import type { Zone } from 'types';
import { zoneToFeature } from 'utils/mapHelper';

const SelectionZone = ({ newZone }: { newZone: Zone }) => (
  <Source type="geojson" data={zoneToFeature(newZone)} key="new-zone">
    <Layer type="line" paint={{ 'line-color': '#666', 'line-dasharray': [3, 3] }} />
  </Source>
);

const SelectionLayers = () => {
  const {
    state,
    editorState: { editorLayers },
    renderingFingerprint,
  } = useContext(EditorContext) as ExtendedEditorContextType<SelectionState>;
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);

  const infraID = useInfraID();

  let selectionZone: Zone | undefined;

  if (state.mousePosition) {
    if (state.selectionState.type === 'rectangle' && state.selectionState.rectangleTopLeft) {
      selectionZone = {
        type: 'rectangle',
        points: [state.selectionState.rectangleTopLeft, state.mousePosition],
      };
    } else if (
      state.selectionState.type === 'polygon' &&
      state.selectionState.polygonPoints.length
    ) {
      selectionZone = {
        type: 'polygon',
        points: state.selectionState.polygonPoints.concat([state.mousePosition]),
      };
    }
  }

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        selection={state.selection.map((e) => e.properties.id)}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
      />
      {selectionZone && <SelectionZone newZone={selectionZone} />}
      {state.mousePosition && state.selectionState.type === 'single' && state.hovered && (
        <Popup
          className="popup editor-selection"
          anchor="bottom"
          longitude={state.mousePosition[0]}
          latitude={state.mousePosition[1]}
          closeButton={false}
        >
          <EntitySumUp
            key={state.hovered.id}
            id={state.hovered.id}
            objType={state.hovered.type}
            error={state.hovered.error}
            status={
              state.selection.find((item) => item.properties.id === state.hovered?.id) && 'selected'
            }
          />
        </Popup>
      )}
    </>
  );
};

export default SelectionLayers;
