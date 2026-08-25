import type { Operation, NetzgrafikDto, NodeDto } from '@osrd-project/netzgrafik-frontend';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import MacroEditorState from '../MacroEditorState';
import type { NodeIndexed } from '../MacroEditorState';
import {
  createMacroNode,
  deleteMacroNodeByNgeId,
  fetchStationSecondaryCodeCountryCode,
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
  position_x: Math.round(node.positionX),
  position_y: Math.round(node.positionY),
  is_collapsed: node.isCollapsed,
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
  type: Operation['type'];
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
          // Update the key if mainCode has changed and key is based on it
          let nodeKey = indexNode.path_item_key;
          let domesticReference = node.betriebspunktName;
          if (nodeKey.startsWith('domestic:') && indexNode.trigram !== domesticReference) {
            const decodedDomesticReference =
              MacroEditorState.decodeDomesticReference(domesticReference);
            const { main_code } = decodedDomesticReference;
            let { secondary_code, country_code } = decodedDomesticReference;
            // TODO: be permissive here? allow typing "MES", "MES/BV", "MES/BV#FR" or "MES#FR"
            if (!secondary_code || country_code === '??') {
              const fetched = await fetchStationSecondaryCodeCountryCode(
                decodedDomesticReference,
                state.infraId,
                dispatch
              );
              if (fetched.secondary_code) secondary_code = fetched.secondary_code;
              if (fetched.country_code) country_code = fetched.country_code;
            }
            domesticReference = MacroEditorState.encodeDomesticReference({
              main_code,
              secondary_code,
              country_code,
              type: 'domestic',
            });
            nodeKey = `domestic:${domesticReference}`;
          }
          await updateMacroNode(state, dispatch, {
            ...indexNode,
            ...castNgeNode(node, netzgrafikDto.labels),
            trigram: node.betriebspunktName, // keep what the user typed
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
        // We assume that `betriebspunktName` follows the `${main_code}/${secondary_code}#${country_code}` format
        const key = MacroEditorState.getPathKey({
          type: 'operational_point_part_reference',
          operational_point: MacroEditorState.decodeDomesticReference(node.betriebspunktName),
          local_track_name: null,
        });
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
