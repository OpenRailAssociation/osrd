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

function shortcutRegistryKey(code: string, optionalKeys?: OptionalKeys): string {
  return [
    optionalKeys?.ctrlKey && 'Ctrl',
    optionalKeys?.shiftKey && 'Shift',
    optionalKeys?.metaKey && 'Meta',
    code,
  ]
    .filter(Boolean)
    .join('-');
}

export default function useKeyboardShortcuts(shortcuts?: Shortcut[]) {
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

  useEffect(() => {
    // register shortcuts given at initialization
    shortcuts?.forEach((s) => register(s));

    // Listen keyboard event on document
    const handleKeyboardEvents = (event: KeyboardEvent) => {
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
    document.body.addEventListener('keydown', handleKeyboardEvents);
    return () => {
      registery.current = {};
      document.body.removeEventListener('keydown', handleKeyboardEvents);
    };
  }, []);

  return { registery: Object.freeze(registery.current), register, unRegister };
}
