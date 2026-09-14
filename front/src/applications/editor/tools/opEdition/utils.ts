import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import { NULL_GEOMETRY } from 'types';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';

import type { OpEditionState, OpEntity } from './types';

function getEmptyOp(): OpEntity {
  return {
    type: 'Feature',
    objType: 'OperationalPoint',
    geometry: NULL_GEOMETRY,
    properties: {
      id: NEW_ENTITY_ID,
      name: '',
    },
  };
}

export function getOpEditionState(entity?: OpEntity): OpEditionState {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    entity: entity ?? getEmptyOp(),
    initialEntity: entity,
    isComplete: Boolean(entity),
  };
}
