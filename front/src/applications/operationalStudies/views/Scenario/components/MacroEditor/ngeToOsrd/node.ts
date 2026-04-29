import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import type { NetzgrafikDto, NGEEvent, NodeDto } from '../../NGE/types';
import type MacroEditorState from '../MacroEditorState';
import type { NodeIndexed } from '../MacroEditorState';
import {
  createMacroNode,
  deleteMacroNodeByNgeId,
  fetchStationSecondaryCode,
  updateMacroNode,
} from '../utils';
import { updateTrainrunsByNode } from './trainrun';

/**
 * Cast a NGE node to a node.
 */
export const castNgeNode = (
  node: NetzgrafikDto['nodes'][0],
  labels: NetzgrafikDto['labels']
): Omit<NodeIndexed, 'path_item_key' | 'dbId'> => ({
  ngeId: node.id,
  trigram: node.betriebspunktName,
  full_name: node.fullName,
  connection_time: node.connectionTime,
  position_x: Math.round(node.positionX),
  position_y: Math.round(node.positionY),
  // TODO : replace this value when nge version gets bumped
  is_collapsed: false,
  labels: node.labelIds
    .map((id) => {
      const ngeLabel = labels.find((e) => e.id === id);
      if (ngeLabel) return ngeLabel.label;
      return null;
    })
    .filter((n) => n !== null),
});

export const handleNodeOperation = async ({
  state,
  type,
  node,
  netzgrafikDto,
  dispatch,
  infraId,
  trainScheduleSetId,
  addUpsertedTrainSchedules,
  addDeletedTrainScheduleIds,
}: {
  state: MacroEditorState;
  type: NGEEvent['type'];
  node: NodeDto;
  netzgrafikDto: NetzgrafikDto;
  dispatch: AppDispatch;
  infraId: number;
  trainScheduleSetId: number;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void;
}): Promise<void> => {
  const indexNode = state.getNodeByNgeId(node.id);
  switch (type) {
    case 'create':
    case 'update': {
      if (indexNode) {
        if (indexNode.dbId) {
          // Update the key if trigram has changed and key is based on it
          let nodeKey = indexNode.path_item_key;
          let trigram = node.betriebspunktName;
          if (nodeKey.startsWith('trigram:') && indexNode.trigram !== trigram) {
            if (!trigram.includes('/')) {
              const secondaryCode = await fetchStationSecondaryCode(
                trigram,
                state.infraId,
                dispatch
              );
              if (secondaryCode) {
                trigram = `${trigram}/${secondaryCode}`;
              }
            }
            nodeKey = `trigram:${trigram}`;
          }
          await updateMacroNode(state, dispatch, {
            ...indexNode,
            ...castNgeNode(node, netzgrafikDto.labels),
            trigram,
            dbId: indexNode.dbId,
            path_item_key: nodeKey,
          });

          if (indexNode.path_item_key !== nodeKey) {
            await updateTrainrunsByNode({
              state,
              netzgrafikDto,
              dispatch,
              infraId,
              trainScheduleSetId,
              addUpsertedTrainSchedules,
              addDeletedTrainScheduleIds,
              node,
            });
          }
        } else {
          const newNode = {
            ...indexNode,
            ...castNgeNode(node, netzgrafikDto.labels),
          };
          // Create the node
          await createMacroNode(state, dispatch, newNode, node.id);
        }
      } else {
        // It's an unknown node, we need to create it in the db
        // We assume that `betriebspunktName` is a trigram
        const key = `trigram:${node.betriebspunktName}`;
        // Create the node
        await createMacroNode(
          state,
          dispatch,
          {
            ...castNgeNode(node, netzgrafikDto.labels),
            path_item_key: key,
          },
          node.id
        );
      }
      break;
    }
    case 'delete': {
      if (indexNode) await deleteMacroNodeByNgeId(state, dispatch, node.id);
      break;
    }
    default:
      break;
  }
};
