import type {
  FreeFloatingTextDto,
  Operation,
  NetzgrafikDto,
} from '@osrd-project/netzgrafik-frontend';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import type MacroEditorState from '../MacroEditorState';

const getNoteLabelTextsFromIds = (netzgrafikDto: NetzgrafikDto, labelIds: number[]): string[] =>
  labelIds
    .map((id) => netzgrafikDto.labels.find((l) => l.id === id)?.label)
    .filter((l) => l !== undefined);

export const castNgeNoteToOsrd = (note: FreeFloatingTextDto, netzgrafikDto: NetzgrafikDto) => ({
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

export const handleNoteOperation = async ({
  type,
  netzgrafikDto,
  note,
  state,
  dispatch,
}: {
  type: Operation['type'];
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
