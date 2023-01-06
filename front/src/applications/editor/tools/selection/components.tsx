import React, { FC, useContext } from 'react';
import { Layer, Popup, Source } from 'react-map-gl';
import { useSelector } from 'react-redux';
import { groupBy, map } from 'lodash';
import { IoMdRemoveCircleOutline } from 'react-icons/io';
import { RiFocus3Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../context';
import { SelectionState } from './types';
import { Zone } from '../../../../types';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import { EditorContextType, ExtendedEditorContextType } from '../types';
import EntitySumUp from '../../components/EntitySumUp';

import './styles.scss';
import { zoneToFeature } from '../../../../utils/mapboxHelper';

export const SelectionMessages: FC = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<SelectionState>;

  return t(`Editor.tools.select-items.help.${state.selectionState.type}-selection`);
};

const SelectionZone: FC<{ newZone?: Zone }> = ({ newZone }) => (
  <>
    {newZone ? (
      <Source type="geojson" data={zoneToFeature(newZone)} key="new-zone">
        <Layer type="line" paint={{ 'line-color': '#666', 'line-dasharray': [3, 3] }} />
      </Source>
    ) : null}
  </>
);

export const SelectionLayers: FC = () => {
  const {
    state,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<SelectionState>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

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
      />
      <SelectionZone newZone={selectionZone} />
      {state.mousePosition && state.selectionState.type === 'single' && state.hovered && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={state.mousePosition[0]}
          latitude={state.mousePosition[1]}
          closeButton={false}
        >
          <EntitySumUp
            key={state.hovered.id}
            id={state.hovered.id}
            objType={state.hovered.type}
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

export const SelectionLeftPanel: FC = () => {
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
                  <IoMdRemoveCircleOutline /> {t('Editor.tools.select-items.unselect')}
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
                <IoMdRemoveCircleOutline /> {t('Editor.tools.select-items.unselect')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};
