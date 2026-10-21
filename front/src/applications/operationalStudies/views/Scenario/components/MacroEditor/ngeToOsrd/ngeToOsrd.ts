import type {
  Operation,
  NetzgrafikDto,
  NodeDto,
  LabelDto,
  FilterSettingDto,
  TrainrunDto,
} from '@osrd-project/netzgrafik-frontend';

import type {
  TrainScheduleFromJson,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import type {
  MacroNodeForm,
  TimetableType,
  TrainSchedule,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';
import type { Duration } from 'utils/duration';

import { DEFAULT_TRAIN_SCHEDULE_PAYLOAD, TRAINRUN_DIRECTIONS } from '../consts';
import MacroEditorState from '../MacroEditorState';
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
  defaultBaseStartTime,
  getDefaultTrainrunTimeWindow,
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

export const relabelDuplicateShortNames = (nodes: NodeDto[]): NodeDto[] => {
  const shortNamesToIds = new Map<string, number[]>();
  for (const node of nodes) {
    if (!shortNamesToIds.has(node.betriebspunktName))
      shortNamesToIds.set(node.betriebspunktName, []);
    shortNamesToIds.get(node.betriebspunktName)!.push(node.id);
  }

  return nodes.map((node) => {
    const shortNameIds = shortNamesToIds.get(node.betriebspunktName)!;
    if (shortNameIds.length === 1) return node;
    const idIndex = shortNameIds.findIndex((id) => id === node.id);
    const newShortName = `${node.betriebspunktName}_${idIndex + 1}`;
    return {
      ...node,
      betriebspunktName: newShortName,
    };
  });
};

/**
 * Convert an NGE dto to a payload for the given timetable type, the same way as when editing in
 * NGE within a timetable of this type:
 * - calendar timetables get absolute start times, on the current day
 * - services get the default duration of NGE services in this timetable
 * - hourly timetables get start times relative to the timetable start, brought back under the
 *   train interval. Unique trains, which do not exist in hourly timetables, become paced trains
 *   whose interval and duration are equal to the hourly timetable duration.
 */
export const convertNgeDtoToOsrd = (
  dto: NetzgrafikDto,
  target: { timetableType: TimetableType; hourlyTimetableDuration: Duration }
): TimetableJsonPayload => {
  const { timetableType, hourlyTimetableDuration } = target;
  const macroNotes = dto.freeFloatingTexts.map((note) => castNgeNoteToOsrd(note, dto));

  const baseStartTime = defaultBaseStartTime(timetableType);
  const getPacedAttributes = (trainrun: TrainrunDto): TrainSchedule['paced'] => {
    const paced = createPacedAttributesFromTrainrun(trainrun, dto, (interval) =>
      getDefaultTrainrunTimeWindow(target, interval)
    );
    if (paced || timetableType !== 'HOURLY') return paced;
    return {
      interval: hourlyTimetableDuration.toISOString(),
      time_window: hourlyTimetableDuration.toISOString(),
      exceptions: [],
    };
  };

  const dedupNodes = relabelDuplicateShortNames(dto.nodes);
  const macroNodes: MacroNodeForm[] = [];
  for (const node of dedupNodes) {
    const domesticNodeLocation = MacroEditorState.decodeDomesticReference(node.betriebspunktName);
    macroNodes.push({
      ...castNgeNode(node, dto.labels),
      node_location: {
        type: 'operational_point_reference',
        operational_point: domesticNodeLocation,
      },
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
        const paced = getPacedAttributes(trainrun);
        const pathAndSchedule = generatePathAndSchedule(
          trainrunSections,
          dedupNodes,
          baseStartTime,
          direction,
          paced
        );
        const isTrainSplit = groupedTrainrunSections.length > 1;
        const commonProps = {
          train_name: isTrainSplit ? `${trainrun.name}-${index + 1}` : trainrun.name,
          labels,
          category,
          ...pathAndSchedule,
        };
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
    timetable_type: timetableType,
    macro_nodes: macroNodes,
    macro_notes: macroNotes,
    train_schedules: trainSchedules,
    round_trips: trainSchedulesRoundTrips,
  };
};
