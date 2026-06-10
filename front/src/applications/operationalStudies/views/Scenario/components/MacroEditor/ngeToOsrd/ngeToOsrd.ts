import type {
  Operation,
  NetzgrafikDto,
  NodeDto,
  LabelDto,
  FilterSettingDto,
} from '@osrd-project/netzgrafik-frontend';

import type {
  TrainScheduleFromJson,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import type { MacroNodeForm, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import { DEFAULT_TRAIN_SCHEDULE_PAYLOAD, TRAINRUN_DIRECTIONS } from '../consts';
import type MacroEditorState from '../MacroEditorState';
import { getTrainCategoryFromTrainrunCategoryId, localStorageFilterSettingKey } from '../utils';
import { castNgeNode, handleNodeOperation } from './node';
import { castNgeNoteToOsrd, handleNoteOperation } from './note';
import {
  handleTrainrunOperation,
  handleUpdateTrainSchedule,
  getTrainrunSectionsByTrainrunId,
  getTrainrunLabels,
  generatePathAndSchedule,
  createPacedAttributesFromTrainrun,
} from './trainrun';

const handleLabelOperation = async ({
  type,
  netzgrafikDto,
  label,
  trainScheduleSetId,
  infraId,
  state,
  dispatch,
  addUpsertedTrainSchedules,
  addDeletedTrainScheduleIds,
}: {
  type: Operation['type'];
  netzgrafikDto: NetzgrafikDto;
  label: LabelDto;
  trainScheduleSetId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void;
}) => {
  const { trainruns } = netzgrafikDto;
  switch (type) {
    case 'update': {
      const trainrunUpdateLabels = trainruns.filter((trainrun) =>
        trainrun.labelIds.includes(label.id)
      );
      trainrunUpdateLabels.forEach(async (trainrun) => {
        await handleUpdateTrainSchedule({
          netzgrafikDto,
          trainrun,
          trainScheduleSetId,
          infraId,
          state,
          dispatch,
          addUpsertedTrainSchedules,
          addDeletedTrainScheduleIds,
        });
      });
      break;
    }
    default: {
      break;
    }
  }
};

const handleMetadataOperation = async ({
  type,
  netzgrafikDto,
}: {
  type: Operation['type'];
  netzgrafikDto: NetzgrafikDto;
}) => {
  switch (type) {
    case 'update': {
      localStorage.setItem('trafficSideNetworkGraph', netzgrafikDto.metadata.trafficSide!);
      break;
    }
    default: {
      break;
    }
  }
};

const handleFilterSettingOperation = async ({
  type,
  filterSetting,
  state,
}: {
  type: Operation['type'];
  filterSetting: FilterSettingDto;
  state: MacroEditorState;
}) => {
  switch (type) {
    case 'update': {
      localStorage.setItem(
        localStorageFilterSettingKey(state.scenarioId),
        JSON.stringify(filterSetting)
      );
      break;
    }
    default: {
      break;
    }
  }
};

export const handleOperation = async ({
  operation,
  netzgrafikDto,
  trainScheduleSetId,
  infraId,
  state,
  dispatch,
  addUpsertedTrainSchedules,
  addDeletedTrainScheduleIds,
}: {
  operation: Operation;
  netzgrafikDto: NetzgrafikDto;
  trainScheduleSetId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  addDeletedTrainScheduleIds: (trainScheduleIds: number[]) => void;
}) => {
  const { type } = operation;
  switch (operation.objectType) {
    case 'node':
      await handleNodeOperation({
        state,
        dispatch,
        netzgrafikDto,
        infraId,
        trainScheduleSetId,
        addUpsertedTrainSchedules,
        addDeletedTrainScheduleIds,
        type,
        node: operation.node,
      });
      break;
    case 'trainrun': {
      await handleTrainrunOperation({
        type,
        netzgrafikDto,
        trainrunId: operation.trainrun.id,
        trainScheduleSetId,
        infraId,
        state,
        dispatch,
        addUpsertedTrainSchedules,
        addDeletedTrainScheduleIds,
      });
      break;
    }
    case 'label':
      await handleLabelOperation({
        type,
        netzgrafikDto,
        label: operation.label,
        trainScheduleSetId,
        infraId,
        state,
        dispatch,
        addUpsertedTrainSchedules,
        addDeletedTrainScheduleIds,
      });
      break;
    case 'note':
      await handleNoteOperation({
        type,
        netzgrafikDto,
        note: operation.note,
        state,
        dispatch,
      });
      break;
    case 'metadata':
      await handleMetadataOperation({
        type,
        netzgrafikDto,
      });
      break;
    case 'filterSetting':
      await handleFilterSettingOperation({
        type,
        filterSetting: operation.filterSetting,
        state,
      });
      break;
    default:
      break;
  }
};

export const relabelDuplicateTrigrams = (nodes: NodeDto[]): NodeDto[] => {
  const trigramsToIds = new Map<string, number[]>();
  for (const node of nodes) {
    if (!trigramsToIds.has(node.betriebspunktName)) trigramsToIds.set(node.betriebspunktName, []);
    trigramsToIds.get(node.betriebspunktName)!.push(node.id);
  }

  return nodes.map((node) => {
    const trigramIds = trigramsToIds.get(node.betriebspunktName)!;
    if (trigramIds.length === 1) return node;
    const idIndex = trigramIds.findIndex((id) => id === node.id);
    const newTrigram = `${node.betriebspunktName}_${idIndex + 1}`;
    return {
      ...node,
      betriebspunktName: newTrigram,
    };
  });
};

export const convertNgeDtoToOsrd = (dto: NetzgrafikDto): TimetableJsonPayload => {
  const macroNotes = dto.freeFloatingTexts.map((note) => castNgeNoteToOsrd(note, dto));

  const dedupNodes = relabelDuplicateTrigrams(dto.nodes);
  const macroNodes: MacroNodeForm[] = [];
  for (const node of dedupNodes) {
    macroNodes.push({
      ...castNgeNode(node, dto.labels),
      path_item_key: `domestic:${node.betriebspunktName}`,
    });
  }

  const trainSchedules: TrainScheduleFromJson[] = [];
  const trainSchedulesRoundTrips: ([number, number] | [number, null])[] = [];
  for (const trainrun of dto.trainruns) {
    const groupedTrainrunSections = getTrainrunSectionsByTrainrunId(dto, trainrun.id);
    const labels = getTrainrunLabels(dto, trainrun);
    const dtoCategory = dto.metadata.trainrunCategories.find((c) => c.id === trainrun.categoryId);
    const categoryObj = getTrainCategoryFromTrainrunCategoryId(
      dto.metadata.trainrunCategories,
      trainrun.categoryId
    );
    const category = categoryObj ?? dtoCategory?.name ?? null;

    const directions =
      trainrun.direction === 'one_way'
        ? [TRAINRUN_DIRECTIONS.FORWARD]
        : [TRAINRUN_DIRECTIONS.FORWARD, TRAINRUN_DIRECTIONS.BACKWARD];
    for (const [index, trainrunSections] of groupedTrainrunSections.entries()) {
      for (const direction of directions) {
        const pathAndSchedule = generatePathAndSchedule(
          trainrunSections,
          dedupNodes,
          undefined,
          direction
        );
        const isTrainSplit = groupedTrainrunSections.length > 1;
        const commonProps = {
          train_name: isTrainSplit ? `${trainrun.name}-${index + 1}` : trainrun.name,
          labels,
          category,
          ...pathAndSchedule,
        };
        const paced = createPacedAttributesFromTrainrun(trainrun, dto);
        trainSchedules.push({
          ...DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
          ...commonProps,
          paced,
        });
        if (direction === TRAINRUN_DIRECTIONS.FORWARD) {
          trainSchedulesRoundTrips.push([
            trainSchedules.length - 1,
            trainrun.direction === 'one_way' ? null : trainSchedules.length,
          ]);
        }
      }
    }
  }

  return {
    macro_nodes: macroNodes,
    macro_notes: macroNotes,
    train_schedules: trainSchedules,
    round_trips: trainSchedulesRoundTrips,
  };
};
