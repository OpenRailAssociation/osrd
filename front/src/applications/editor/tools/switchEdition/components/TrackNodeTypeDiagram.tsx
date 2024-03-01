import React, { useMemo } from 'react';

import crossing from 'assets/pictures/trackNodeTypes/crossing.svg';
import doubleSlipSwitch from 'assets/pictures/trackNodeTypes/double_slip_switch.svg';
import link from 'assets/pictures/trackNodeTypes/link.svg';
import pointSwitch from 'assets/pictures/trackNodeTypes/point_switch.svg';
import singleSlipSwitch from 'assets/pictures/trackNodeTypes/single_slip_switch.svg';

import type { TrackNodeTypeId } from '../types';

enum TRACK_NODE_TYPES_ID {
  CROSSING = 'crossing',
  SINGLE_SLIP_SWITCH = 'single_slip_switch',
  DOUBLE_SLIP_SWITCH = 'double_slip_switch',
  LINK = 'link',
  POINT_SWITCH = 'point_switch',
}

const TrackNodeTypeDiagram = ({ trackNodeType }: { trackNodeType: TrackNodeTypeId }) => {
  const trackNodeTypeImage = useMemo(() => {
    let source: string | undefined;
    switch (trackNodeType) {
      case TRACK_NODE_TYPES_ID.CROSSING:
        source = crossing;
        break;
      case TRACK_NODE_TYPES_ID.SINGLE_SLIP_SWITCH:
        source = singleSlipSwitch;
        break;
      case TRACK_NODE_TYPES_ID.DOUBLE_SLIP_SWITCH:
        source = doubleSlipSwitch;
        break;
      case TRACK_NODE_TYPES_ID.LINK:
        source = link;
        break;
      case TRACK_NODE_TYPES_ID.POINT_SWITCH:
        source = pointSwitch;
        break;
      default:
        source = undefined;
    }
    return source;
  }, [trackNodeType]);
  return trackNodeTypeImage && <img src={trackNodeTypeImage} alt={trackNodeType} />;
};

export default TrackNodeTypeDiagram;
