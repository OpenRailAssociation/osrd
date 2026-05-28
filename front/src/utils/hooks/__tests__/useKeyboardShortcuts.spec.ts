import { useRef } from 'react';

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleKeyboardEvents, type Shortcut } from '../useKeyboardShortcuts';

describe('handleKeyboardEvents', () => {
  let handlerMock: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    handlerMock = vi.fn();
    const { result } = renderHook(() => {
      const registery = useRef<Record<string, Shortcut>>({});
      return { registery };
    });
    // Register a shortcut for testing
    document.addEventListener('keydown', (event) =>
      handleKeyboardEvents(event, result.current.registery)
    );
    result.current.registery.current['Ctrl-KeyS'] = {
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock,
    };
  });

  it('should call the handler when the correct shortcut is pressed', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyS',
      ctrlKey: true,
    });
    document.dispatchEvent(event);
    expect(handlerMock).toHaveBeenCalled();
  });

  it.each([
    { code: 'KeyI', metaKey: true, altKey: true },
    { code: 'KeyC', ctrlKey: true },
    { code: 'KeyC', metaKey: true },
  ])('should not call the handler when the wrong shortcut is pressed', (eventProps) => {
    const event = new KeyboardEvent('keydown', eventProps);
    document.dispatchEvent(event);
    expect(handlerMock).not.toHaveBeenCalled();
  });

  it.each([{ tag: 'input' }, { tag: 'textarea' }])(
    'should not call the handler when the event target is an input or textarea',
    ({ tag }) => {
      const input = document.createElement(tag);
      document.body.appendChild(input);
      const event = new KeyboardEvent('keydown', {
        code: 'KeyS',
        ctrlKey: true,
      });
      input.dispatchEvent(event);
      expect(handlerMock).not.toHaveBeenCalled();
    }
  );
});
