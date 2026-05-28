import { useRef, useEffect, useCallback } from 'react';

import { omit } from 'lodash';

type OptionalKeys = {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
};

export type Shortcut = {
  optionalKeys?: OptionalKeys;
  code: string;
  handler: () => void;
};

export function shortcutRegistryKey(code: string, optionalKeys?: OptionalKeys): string {
  return [
    optionalKeys?.ctrlKey && 'Ctrl',
    optionalKeys?.shiftKey && 'Shift',
    optionalKeys?.metaKey && 'Meta',
    code,
  ]
    .filter(Boolean)
    .join('-');
}

// Listen keyboard event on document
export const handleKeyboardEvents = (
  event: KeyboardEvent,
  registery: React.RefObject<Record<string, Shortcut>>
) => {
  if (event.target instanceof Element) {
    // prevent keyboard shortcut execution in text inputs.
    if (event.target.matches('input, textarea')) return;

    // disable the handler for chrome developer tools
    if (event.code === 'KeyI' && event.metaKey && event.altKey) return;

    // disable the handler for copy keyboard shortcut (ctrl+c, cmd+c)
    if (event.code === 'KeyC' && (event.metaKey || event.ctrlKey)) return;
  }

  const shortcutKey = shortcutRegistryKey(event.code, {
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  });
  const shortcut = registery.current[shortcutKey];
  if (shortcut) {
    shortcut.handler();
    event.preventDefault();
  }
};

/**
 * Custom hook to manage keyboard shortcuts application.
 * It allows you to register and unregister keyboard shortcuts,
 * and handles the execution of the corresponding handlers when the specified key combinations are pressed.
 *
 * Registry is stored in a ref to avoid unnecessary re-renders when shortcuts are registered or unregistered.
 *
 * The hook listens for keyboard events on the document body and checks if the pressed key combination matches any registered shortcut.
 * If a match is found, the corresponding handler is executed, and the default behavior of the event is prevented.
 *
 * @param shortcuts - An optional array of shortcuts to register when the hook is initialized.
 * Each shortcut should include a `code` representing the key code, an optional `optionalKeys` object specifying modifier keys (shift, ctrl, meta), and a `handler` function to execute when the shortcut is triggered.
 * @return An object containing the current registry of shortcuts (as a read-only record), and functions to register and unregister shortcuts.
 */
export default function useKeyboardShortcuts(shortcuts?: Shortcut[]): {
  registery: Readonly<Record<string, Shortcut>>;
  register: (shortcut: Shortcut) => void;
  unRegister: (shortcut: Shortcut) => void;
} {
  const registery = useRef<Record<string, Shortcut>>({});

  const register = useCallback(
    (shortcut: Shortcut) => {
      registery.current = {
        ...registery.current,
        [shortcutRegistryKey(shortcut.code, shortcut.optionalKeys)]: shortcut,
      };
    },
    [registery]
  );

  const unRegister = useCallback(
    (shortcut: Shortcut) => {
      const shortcutKey = shortcutRegistryKey(shortcut.code, shortcut.optionalKeys);
      registery.current = omit(registery.current, [shortcutKey]);
    },
    [registery]
  );

  const eventFunction = (event: KeyboardEvent) => handleKeyboardEvents(event, registery);

  useEffect(() => {
    // register shortcuts given at initialization
    shortcuts?.forEach((s) => register(s));

    document.body.addEventListener('keydown', eventFunction);
    return () => {
      registery.current = {};
      document.body.removeEventListener('keydown', eventFunction);
    };
  }, []);

  return { registery: Object.freeze(registery.current), register, unRegister };
}
