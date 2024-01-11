import React, { useContext } from 'react';
import { Layer, Popup, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import { groupBy, map } from 'lodash';
import { GoNoEntry } from 'react-icons/go';
import { RiFocus3Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import type { Zone } from 'types';

import { zoneToFeature } from 'utils/mapHelper';

import EditorContext from 'applications/editor/context';
import 'applications/editor/tools/selection/styles.scss';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type {
  EditorContextType,
  ExtendedEditorContextType,
} from 'applications/editor/tools/editorContextTypes';

import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import { useInfraID } from 'common/osrdContext';

import { getMap } from 'reducers/map/selectors';

export const SelectionMessages = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<SelectionState>;

  return t(`Editor.tools.select-items.help.${state.selectionState.type}-selection`).toString();
};

const SelectionZone = ({ newZone }: { newZone: Zone }) => (
  <Source type="geojson" data={zoneToFeature(newZone)} key="new-zone">
    <Layer type="line" paint={{ 'line-color': '#666', 'line-dasharray': [3, 3] }} />
  </Source>
);

export const SelectionLayers = () => {
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
              state.selection.find(
                (item) => item.properties.id === (state.hovered?.id as string)
              ) && 'selected'
            }
          />
        </Popup>
      )}
    </>
  );
};

export const SelectionLeftPanel = () => {
  const { t } = useTranslation();
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SelectionState>;
  const { selection } = state;

  if (!selection.length)
    return <p className="text-center">{t('Editor.tools.select-items.no-selection')}</p>;

  if (selection.length > 5) {
    const types = groupBy(selection, (item) => item.objType);

    return (
      <>
        <h4>{t('Editor.tools.select-items.title')}</h4>
        <ul className="list-unstyled">
          {map(types, (items, type) => (
            <li key={type} className="pb-4">
              <div className="pb-2">
                {t('Editor.tools.select-items.selection', { count: items.length })}{' '}
                {t('Editor.tools.select-items.of-type')} <strong>{type}</strong>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mr-2"
                  onClick={() =>
                    setState({ ...state, selection: selection.filter((i) => i.objType === type) })
                  }
                >
                  <RiFocus3Line /> {t('Editor.tools.select-items.focus')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setState({ ...state, selection: selection.filter((i) => i.objType !== type) })
                  }
                >
                  <GoNoEntry /> {t('Editor.tools.select-items.unselect')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <h4>{t('Editor.tools.select-items.title')}</h4>
      <ul className="list-unstyled">
        {selection.map((item) => (
          <li key={item.properties.id} className="pb-4">
            <div className="pb-2 entity">
              <EntitySumUp entity={item} classes={{ small: '' }} />
            </div>
            <div>
              {selection.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mr-2"
                  onClick={() => setState({ ...state, selection: [item] })}
                >
                  <RiFocus3Line /> {t('Editor.tools.select-items.focus')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setState({
                    ...state,
                    selection: selection.filter((i) => i.properties.id !== item.properties.id),
                  })
                }
              >
                <GoNoEntry /> {t('Editor.tools.select-items.unselect')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};
