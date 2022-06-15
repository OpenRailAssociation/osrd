import React, { FC, useContext } from 'react';
import { Popup } from 'react-map-gl';
import { useSelector } from 'react-redux';

import { EditorContext, EditorContextType } from '../../context';
import { SelectionState } from './types';
import { Item, Zone } from '../../../../types';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';

export const SelectionMessages: FC = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<SelectionState>;
  if (!state.selection.length) return t('Editor.tools.select-items.no-selection');
  return t('Editor.tools.select-items.selection', { count: state.selection.length });
};

export const SelectionLayers: FC = () => {
  const { state } = useContext(EditorContext) as EditorContextType<SelectionState>;
  const { mapStyle } = useSelector((s: { map: any }) => s.map) as { mapStyle: string };

  let selectionZone: Zone | undefined;

  if (state.selectionState.type === 'rectangle' && state.selectionState.rectangleTopLeft) {
    selectionZone = {
      type: 'rectangle',
      points: [state.selectionState.rectangleTopLeft, state.mousePosition],
    };
  } else if (state.selectionState.type === 'polygon' && state.selectionState.polygonPoints.length) {
    selectionZone = {
      type: 'polygon',
      points: state.selectionState.polygonPoints.concat([state.mousePosition]),
    };
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
      {state.selectionState.type === 'single' && state.hovered && (
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
