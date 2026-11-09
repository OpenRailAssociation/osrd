import type { MacroNoteResponse, ScenarioEvent } from 'common/api/osrdEditoastApi';

import { useScenarioEvents, type ScenarioEventType } from './useScenarioEvents';

const MACRO_NOTE_EVENT_TYPES: readonly ScenarioEventType[] = [
  'MacroNoteUpserted',
  'MacroNoteDeleted',
];

type UseMacroNoteEventsParams = {
  enabled: boolean;
  onUpsert: (note: MacroNoteResponse) => void;
  onDelete: (noteId: number) => void;
};

/** Notifies the macro notes created, updated or deleted from another client. */
const useMacroNoteEvents = ({ enabled, onUpsert, onDelete }: UseMacroNoteEventsParams) => {
  'use memo';

  useScenarioEvents(
    MACRO_NOTE_EVENT_TYPES,
    (event: ScenarioEvent) => {
      if (event.type === 'MacroNoteUpserted') onUpsert(event);
      else if (event.type === 'MacroNoteDeleted') onDelete(event.id);
    },
    enabled
  );
};

export default useMacroNoteEvents;
