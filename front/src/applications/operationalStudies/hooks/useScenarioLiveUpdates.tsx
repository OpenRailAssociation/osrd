import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import type { LiveUpdateEvent, LiveUpdateMessage } from 'common/api/osrdEditoastApi';
import { MAIN_API } from 'config/config';

// TODO: each synchronized kind of object should get its own hook (like
// `useMacroNoteLiveUpdates`) built on top of `useLiveUpdates`, filtering on its own event types.
export type LiveUpdateEventType = LiveUpdateEvent['type'];
type LiveUpdateListener = (event: LiveUpdateEvent) => void;

type ScenarioLiveUpdatesContextType = {
  /** Registers a listener for the given event types. Returns the unsubscribe function. */
  subscribe: (types: readonly LiveUpdateEventType[], listener: LiveUpdateListener) => () => void;
} | null;

const ScenarioLiveUpdatesContext = createContext<ScenarioLiveUpdatesContextType>(null);

// TODO: the endpoint is specific to macro notes for now, it should become a generic scenario
// endpoint when other types of objects will be synchronized.
const buildSocketUrl = (scenarioId: number) =>
  `${MAIN_API.proxy_editoast}/macro_notes/updates?scenario_id=${scenarioId}`;

type ScenarioLiveUpdatesProviderProps = {
  scenarioId: number;
  children: ReactNode;
};

/**
 * Owns the live updates WebSocket of a scenario and dispatches the received events to the
 * listeners registered by event type.
 *
 * The socket is opened when the first listener subscribes and closed once the last one leaves.
 */
export const ScenarioLiveUpdatesProvider = ({
  scenarioId,
  children,
}: ScenarioLiveUpdatesProviderProps) => {
  'use memo';

  const listeners = useRef(new Map<LiveUpdateEventType, Set<LiveUpdateListener>>());
  const socket = useRef<WebSocket | null>(null);

  const hasActiveListener = () => [...listeners.current.values()].some((set) => set.size > 0);

  const openSocket = () => {
    if (socket.current) return;

    const ws = new WebSocket(buildSocketUrl(scenarioId));
    ws.onmessage = (messageEvent) => {
      try {
        const message: LiveUpdateMessage = JSON.parse(messageEvent.data);
        message.events.forEach((event) => {
          listeners.current.get(event.type)?.forEach((listener) => listener(event));
        });
      } catch (error) {
        console.error('Invalid live update message', error);
      }
    };
    ws.onerror = (error) => console.error('Live updates WebSocket error', error);
    ws.onclose = () => {
      if (socket.current === ws) socket.current = null;
    };
    socket.current = ws;
  };

  const subscribe: NonNullable<ScenarioLiveUpdatesContextType>['subscribe'] = (types, listener) => {
    types.forEach((type) => {
      if (!listeners.current.has(type)) listeners.current.set(type, new Set());
      listeners.current.get(type)!.add(listener);
    });
    openSocket();

    return () => {
      types.forEach((type) => listeners.current.get(type)?.delete(listener));
      if (!hasActiveListener()) {
        socket.current?.close();
        socket.current = null;
      }
    };
  };

  const providedContext = { subscribe };

  return (
    // need to disable the lint because of "use memo" and oxlint collision
    // eslint-disable-next-line react/jsx-no-constructed-context-values
    <ScenarioLiveUpdatesContext.Provider value={providedContext}>
      {children}
    </ScenarioLiveUpdatesContext.Provider>
  );
};

/**
 * Calls `onEvent` for each received event of the given types, while `enabled` is true.
 * `types` must be a constant, otherwise the hook resubscribes on each render.
 */
export const useLiveUpdates = (
  types: readonly LiveUpdateEventType[],
  onEvent: LiveUpdateListener,
  enabled = true
) => {
  'use memo';

  const context = useContext(ScenarioLiveUpdatesContext);
  if (!context) {
    throw new Error('useLiveUpdates must be used within a ScenarioLiveUpdatesProvider');
  }
  const { subscribe } = context;

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(types, (event) => onEventRef.current(event));
  }, [subscribe, types, enabled]);
};
