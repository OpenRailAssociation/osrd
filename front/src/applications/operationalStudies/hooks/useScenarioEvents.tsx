import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import type { ScenarioEvent, ScenarioEventMessage } from 'common/api/osrdEditoastApi';
import { createSocket as createDefaultSocket, type EventWebSocket } from 'common/EventWebSocket';
import { MAIN_API } from 'config/config';

// TODO: each synchronized kind of object should get its own hook (like
// `useMacroNoteEvents`) built on top of `useScenarioEvents`, filtering on its own event types.
export type ScenarioEventType = ScenarioEvent['type'];
type ScenarioEventListener = (event: ScenarioEvent) => void;

type ScenarioEventsContextType = {
  /** Registers a listener for the given event types. Returns the unsubscribe function. */
  subscribe: (types: readonly ScenarioEventType[], listener: ScenarioEventListener) => () => void;
} | null;

const ScenarioEventsContext = createContext<ScenarioEventsContextType>(null);

const getScenarioEventsUrl = (scenarioId: number) =>
  `${MAIN_API.proxy_editoast}/scenarios/${scenarioId}/events`;

/** Extracts the event of a message sent by the server. */
const parseMessage = (data: string): ScenarioEvent | 'FatalError' => {
  const message: ScenarioEventMessage = JSON.parse(data);
  return message === 'FatalError' ? message : message.Event.event;
};

type Subscription = {
  types: readonly ScenarioEventType[];
  listener: ScenarioEventListener;
};

type ScenarioEventsProviderProps = {
  scenarioId: number;
  /** Creates the socket from its url. Can be replaced by a mock in tests. */
  createSocket?: (url: string) => EventWebSocket;
  children: ReactNode;
};

/**
 * Owns the events WebSocket of a scenario and dispatches the received events to the
 * listeners subscribed to their type.
 *
 * The socket is opened when the first listener subscribes and closed once the last one leaves.
 */
export const ScenarioEventsProvider = ({
  scenarioId,
  createSocket = createDefaultSocket,
  children,
}: ScenarioEventsProviderProps) => {
  'use memo';

  const subscriptions = useRef(new Set<Subscription>());
  const socket = useRef<EventWebSocket | null>(null);

  const openSocket = () => {
    if (socket.current) return;

    const ws = createSocket(getScenarioEventsUrl(scenarioId));
    ws.onmessage = (messageEvent) => {
      try {
        const event = parseMessage(messageEvent.data);
        if (event === 'FatalError') {
          console.error('Fatal error on the scenario events WebSocket');
          return;
        }
        subscriptions.current.forEach(({ types, listener }) => {
          if (types.includes(event.type)) listener(event);
        });
      } catch (error) {
        console.error('Invalid scenario event message', error);
      }
    };
    ws.onerror = (error) => console.error('Scenario events WebSocket error', error);
    ws.onclose = () => {
      if (socket.current === ws) socket.current = null;
    };
    socket.current = ws;
  };

  const subscribe: NonNullable<ScenarioEventsContextType>['subscribe'] = (types, listener) => {
    const subscription = { types, listener };
    subscriptions.current.add(subscription);
    openSocket();

    return () => {
      subscriptions.current.delete(subscription);
      if (subscriptions.current.size === 0) {
        socket.current?.close();
        socket.current = null;
      }
    };
  };

  const providedContext = { subscribe };

  return (
    // need to disable the lint because of "use memo" and oxlint collision
    // eslint-disable-next-line react/jsx-no-constructed-context-values
    <ScenarioEventsContext.Provider value={providedContext}>
      {children}
    </ScenarioEventsContext.Provider>
  );
};

/**
 * Calls `onEvent` for each received event of the given types, while `enabled` is true.
 * `types` must be a constant, otherwise the hook resubscribes on each render.
 */
export const useScenarioEvents = (
  types: readonly ScenarioEventType[],
  onEvent: ScenarioEventListener,
  enabled = true
) => {
  'use memo';

  const context = useContext(ScenarioEventsContext);
  if (!context) {
    throw new Error('useScenarioEvents must be used within a ScenarioEventsProvider');
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
