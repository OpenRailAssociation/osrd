import type { LiveUpdateEvent, MacroNoteResponse } from 'common/api/osrdEditoastApi';

import { useLiveUpdates, type LiveUpdateEventType } from './useScenarioLiveUpdates';

const MACRO_NOTE_EVENT_TYPES: readonly LiveUpdateEventType[] = [
  'MacroNoteUpserted',
  'MacroNoteDeleted',
];

type UseMacroNoteLiveUpdatesParams = {
  enabled: boolean;
  onUpsert: (note: MacroNoteResponse) => void;
  onDelete: (noteId: number) => void;
};

/** Notifies the macro notes created, updated or deleted from another client. */
const useMacroNoteLiveUpdates = ({
  enabled,
  onUpsert,
  onDelete,
}: UseMacroNoteLiveUpdatesParams) => {
  'use memo';

  useLiveUpdates(
    MACRO_NOTE_EVENT_TYPES,
    (event: LiveUpdateEvent) => {
      if (event.type === 'MacroNoteUpserted') onUpsert(event.note_state);
      else if (event.type === 'MacroNoteDeleted') onDelete(event.id);
    },
    enabled
  );
};

export default useMacroNoteLiveUpdates;
