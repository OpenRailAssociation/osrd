import React, { FC, useContext } from 'react';
import { Popup } from 'react-map-gl';
import { useDispatch, useSelector } from 'react-redux';
import { groupBy, map } from 'lodash';
import { IoMdRemoveCircleOutline } from 'react-icons/io';
import { RiFocus3Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import { EditorContext, EditorContextType } from '../../context';
import { SelectionState } from './types';
import { Item, Zone } from '../../../../types';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';

export const SelectionMessages: FC = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<SelectionState>;
  if (!state.selection.length) return t('Editor.tools.select-items.no-selection');
  return t('Editor.tools.select-items.selection', { count: state.selection.length });
};

export const SelectionLayers: FC = () => {
  const { state } = useContext(EditorContext) as EditorContextType<SelectionState>;
  const { mapStyle } = useSelector((s: { map: any }) => s.map) as { mapStyle: string };

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

  let labelParts =
    state.hovered &&
    [
      state.hovered.properties.RA_libelle_gare,
      state.hovered.properties.RA_libelle_poste,
      state.hovered.properties.RA_libelle_poste_metier,
      state.hovered.properties.OP_id_poste_metier,
      state.hovered.properties.track_number,
    ].filter((s) => !!s && s !== 'null');

  if (state.hovered && !labelParts?.length) {
    labelParts = [state.hovered.id];
  }

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        hoveredIDs={state.hovered && !selectionZone ? [state.hovered] : []}
        selectionIDs={state.selection as Item[]}
      />
      <EditorZone newZone={selectionZone} />
      {state.mousePosition && state.selectionState.type === 'single' && state.hovered && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={state.mousePosition[0]}
          latitude={state.mousePosition[1]}
          closeButton={false}
        >
          {labelParts && labelParts.map((s, i) => <div key={i}>{s}</div>)}
        </Popup>
      )}
    </>
  );
};

export const SelectionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState } = useContext(EditorContext) as EditorContextType<SelectionState>;
  const { selection, selectionState } = state;

  if (selectionState.type === 'edition') {
    const types = new Set<string>();
    selection.forEach((item) => types.add(item.objType));

    if (selection.length === 1) {
      return (
        <EditorForm
          data={selection[0]}
          onSubmit={async (savedEntity) => {
            await dispatch<any>(save({ update: [savedEntity] }));
            setState({ ...state, selection: [savedEntity], selectionState: { type: 'single' } });
          }}
        >
          <div className="text-right">
            <button
              type="button"
              className="btn btn-danger mr-2"
              onClick={() =>
                setState({
                  ...state,
                  selectionState: selectionState.previousState || { type: 'single' },
                })
              }
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.confirm')}
            </button>
          </div>
        </EditorForm>
      );
    }

    if (types.size === 1) {
      return (
        <p className="text-center">
          It is not yet possible to edit simultaneously items with the same type (TODO).
        </p>
      );
    }

    return (
      <p className="text-center">
        It is not possible to edit simultaneously items with different types.
      </p>
    );
  }

  if (!selection.length) return <p className="text-center">No item selected yet</p>;

  if (selection.length > 5) {
    const types = groupBy(selection, (item) => item.objType);

    return (
      <>
        <h4>Selection</h4>
        <ul className="list-unstyled">
          {map(types, (items, type) => (
            <li key={type} className="pb-4">
              <div className="pb-2">
                {items.length} selected item{items.length > 1 ? 's' : ''} of type{' '}
                <strong>{type}</strong>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mr-2"
                  onClick={() =>
                    setState({ ...state, selection: selection.filter((i) => i.objType === type) })
                  }
                >
                  <RiFocus3Line /> Focus
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setState({ ...state, selection: selection.filter((i) => i.objType !== type) })
                  }
                >
                  <IoMdRemoveCircleOutline /> Deselect
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
      <h4>Selection</h4>
      <ul className="list-unstyled">
        {selection.map((item) => (
          <li key={item.id} className="pb-4">
            <div className="pb-2">
              Item <strong>{item.id}</strong> of type <strong>{item.objType}</strong>
            </div>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm mr-2"
                onClick={() => setState({ ...state, selection: [item] })}
              >
                <RiFocus3Line /> Focus
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setState({ ...state, selection: selection.filter((i) => i.id !== item.id) })
                }
              >
                <IoMdRemoveCircleOutline /> Deselect
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};
