import type {
  PacedTrainFromJson,
  TrainScheduleFromJson,
} from 'applications/operationalStudies/types';
import { osrdEditoastApi, type MacroNodeForm } from 'common/api/osrdEditoastApi';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import type { AppDispatch } from 'store';

import type {
  FreeFloatingTextDto,
  NetzgrafikDto,
  NGEEvent,
  NodeDto,
  LabelDto,
} from '../../NGE/types';
import {
  DEFAULT_PACED_TRAIN_PAYLOAD,
  DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
  TRAINRUN_DIRECTIONS,
} from '../consts';
import type MacroEditorState from '../MacroEditorState';
import { getTrainCategoryFromTrainrunCategoryId } from '../utils';
import { castNgeNode, handleNodeOperation } from './node';
import {
  handleTrainrunOperation,
  handleUpdateTimetableItem,
  getTrainrunSectionsByTrainrunId,
  getTrainrunLabels,
  generatePathAndSchedule,
  createPacedAttributesFromTrainrun,
} from './trainrun';

const getNoteLabelTextsFromIds = (netzgrafikDto: NetzgrafikDto, labelIds: number[]): string[] =>
  labelIds
    .map((id) => netzgrafikDto.labels.find((l) => l.id === id)?.label)
    .filter((l) => l !== undefined);

const castNgeNoteToOsrd = (note: FreeFloatingTextDto, netzgrafikDto: NetzgrafikDto) => ({
  x: Math.round(note.x),
  y: Math.round(note.y),
  title: note.title,
  text: note.text,
  labels: getNoteLabelTextsFromIds(netzgrafikDto, note.labelIds),
});

export const createMacroNote = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  netzgrafikDto: NetzgrafikDto,
  note: FreeFloatingTextDto
) => {
  const response = await dispatch(
    osrdEditoastApi.endpoints.postMacroNotes.initiate({
      macroNoteBatchForm: {
        scenario_id: state.scenarioId,
        macro_notes: [castNgeNoteToOsrd(note, netzgrafikDto)],
      },
    })
  ).unwrap();

  const createdNote = response.macro_notes[0];
  state.setDbIdForNote(note.id, createdNote.id);
};

export const updateMacroNote = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  netzgrafikDto: NetzgrafikDto,
  note: FreeFloatingTextDto
) => {
  const dbId = state.getDbIdForNote(note.id);
  if (!dbId) throw new Error(`Note ${note.id} is not saved in the DB`);

  await dispatch(
    osrdEditoastApi.endpoints.putMacroNotesByNoteId.initiate({
      noteId: dbId,
      macroNoteForm: castNgeNoteToOsrd(note, netzgrafikDto),
    })
  ).unwrap();
};

export const deleteMacroNote = async (
  state: MacroEditorState,
  dispatch: AppDispatch,
  ngeId: number
) => {
  const noteId = state.getDbIdForNote(ngeId);
  if (!noteId) throw new Error(`Note ${ngeId} is not saved in the DB`);

  await dispatch(
    osrdEditoastApi.endpoints.deleteMacroNotesByNoteId.initiate({
      noteId: noteId,
    })
  ).unwrap();

  state.removeNoteMapping(ngeId);
};

const handleNoteOperation = async ({
  type,
  netzgrafikDto,
  note,
  state,
  dispatch,
}: {
  type: NGEEvent['type'];
  netzgrafikDto: NetzgrafikDto;
  note: FreeFloatingTextDto;
  state: MacroEditorState;
  dispatch: AppDispatch;
}) => {
  switch (type) {
    case 'create': {
      await createMacroNote(state, dispatch, netzgrafikDto, note);
      break;
    }
    case 'update': {
      await updateMacroNote(state, dispatch, netzgrafikDto, note);
      break;
    }
    case 'delete': {
      await deleteMacroNote(state, dispatch, note.id);
      break;
    }
    default:
      break;
  }
};

const handleLabelOperation = async ({
  type,
  netzgrafikDto,
  label,
  timetableId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  type: NGEEvent['type'];
  netzgrafikDto: NetzgrafikDto;
  label: LabelDto;
  timetableId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemIds: TimetableItemId[]) => void;
}) => {
  const { trainruns } = netzgrafikDto;
  switch (type) {
    case 'update': {
      const trainrunUpdateLabels = trainruns.filter((trainrun) =>
        trainrun.labelIds.includes(label.id)
      );
      trainrunUpdateLabels.forEach(async (trainrun) => {
        await handleUpdateTimetableItem({
          netzgrafikDto,
          trainrun,
          timetableId,
          infraId,
          state,
          dispatch,
          addUpsertedTimetableItems,
          addDeletedTimetableItemIds,
        });
      });
      break;
    }
    default: {
      break;
    }
  }
};

export const handleOperation = async ({
  event,
  netzgrafikDto,
  timetableId,
  infraId,
  state,
  dispatch,
  addUpsertedTimetableItems,
  addDeletedTimetableItemIds,
}: {
  event: NGEEvent;
  netzgrafikDto: NetzgrafikDto;
  timetableId: number;
  infraId: number;
  state: MacroEditorState;
  dispatch: AppDispatch;
  addUpsertedTimetableItems: (timetableItems: TimetableItem[]) => void;
  addDeletedTimetableItemIds: (timetableItemsIds: TimetableItemId[]) => void;
}) => {
  const { type } = event;
  switch (event.objectType) {
    case 'node':
      await handleNodeOperation({ state, dispatch, netzgrafikDto, type, node: event.node });
      break;
    case 'trainrun': {
      await handleTrainrunOperation({
        type,
        netzgrafikDto,
        trainrunId: event.trainrun.id,
        timetableId,
        infraId,
        state,
        dispatch,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds,
      });
      break;
    }
    case 'label':
      await handleLabelOperation({
        type,
        netzgrafikDto,
        label: event.label,
        timetableId,
        infraId,
        state,
        dispatch,
        addUpsertedTimetableItems,
        addDeletedTimetableItemIds,
      });
      break;
    case 'note':
      await handleNoteOperation({
        type,
        netzgrafikDto,
        note: event.note,
        state,
        dispatch,
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
    if (trigramIds.length == 1) return node;
    const idIndex = trigramIds.findIndex((id) => id === node.id);
    const newTrigram = `${node.betriebspunktName}-${idIndex + 1}`;
    return {
      ...node,
      betriebspunktName: newTrigram,
    };
  });
};

export const convertNgeDtoToOsrd = (dto: NetzgrafikDto) => {
  const macroNotes = dto.freeFloatingTexts.map((note) => castNgeNoteToOsrd(note, dto));

  const dedupNodes = relabelDuplicateTrigrams(dto.nodes);
  const macroNodes: MacroNodeForm[] = [];
  for (const node of dedupNodes) {
    macroNodes.push({
      ...castNgeNode(node, dto.labels),
      path_item_key: `trigram:${node.betriebspunktName}`,
    });
  }

  const trainSchedules: TrainScheduleFromJson[] = [];
  const pacedTrains: PacedTrainFromJson[] = [];
  const pacedTrainsRoundTrips: ([number, number] | [number, null])[] = [];
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
        if (paced) {
          pacedTrains.push({
            ...DEFAULT_PACED_TRAIN_PAYLOAD,
            ...commonProps,
            paced,
          });
          if (direction === TRAINRUN_DIRECTIONS.FORWARD) {
            pacedTrainsRoundTrips.push([
              pacedTrains.length - 1,
              trainrun.direction === 'one_way' ? null : pacedTrains.length,
            ]);
          }
        } else {
          trainSchedules.push({
            ...DEFAULT_TRAIN_SCHEDULE_PAYLOAD,
            ...commonProps,
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
  }

  return {
    macro_nodes: macroNodes,
    macro_notes: macroNotes,
    paced_trains: pacedTrains,
    train_schedules: trainSchedules,
    round_trips: { train_schedules: trainSchedulesRoundTrips, paced_trains: pacedTrainsRoundTrips },
  };
};
