import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';

import { EditorContext, EditorContextType } from '../../context';
import { Zone } from '../../../../types';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import TracksGeographic from '../../../../common/Map/Layers/TracksGeographic';
import { ZoneSelectionState } from './types';

export const ZoneSelectionLayers: FC = () => {
  const { state } = useContext(EditorContext) as EditorContextType<ZoneSelectionState>;
  const { mapStyle } = useSelector((s: { map: any }) => s.map) as { mapStyle: string };
  let newZone: Zone | undefined;

  if (state.mousePosition) {
    if (state.zoneState.type === 'rectangle' && state.zoneState.topLeft) {
      newZone = {
        type: 'rectangle',
        points: [state.zoneState.topLeft, state.mousePosition],
      };
    }

    if (state.zoneState.type === 'polygon' && state.zoneState.points.length) {
      newZone = {
        type: 'polygon',
        points: [...state.zoneState.points, state.mousePosition],
      };
    }
  }

  return (
    <>
      <TracksGeographic colors={colors[mapStyle]} />
      <EditorZone newZone={newZone} />
    </>
  );
};
