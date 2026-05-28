import { useRef } from 'react';

import { fireEvent, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import useKeyboardShortcuts, { handleKeyboardEvents, type Shortcut } from '../useKeyboardShortcuts';

describe('handleKeyboardEvents', () => {
  let handlerMock: () => void;

  const { result } = renderHook(() => {
    const registery = useRef<Record<string, Shortcut>>({});
    return { registery };
  });

  const handleEvent = (event: KeyboardEvent) =>
    handleKeyboardEvents(event, result.current.registery);

  beforeEach(() => {
    vi.clearAllMocks();
    handlerMock = vi.fn();

    // Register a shortcut for testing
    document.addEventListener('keydown', handleEvent);
    result.current.registery.current['Ctrl-KeyS'] = {
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock,
    };
  });

  afterEach(() => {
    document.removeEventListener('keydown', handleEvent);
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
        bubbles: true, // Ensure the event bubbles up to the document
      });
      input.dispatchEvent(event);
      expect(handlerMock).not.toHaveBeenCalled();
    }
  );
});

describe('useKeyboardShortcuts', () => {
  const handlerMock1 = vi.fn();
  const handlerMock2 = vi.fn();

  const { result } = renderHook(() => useKeyboardShortcuts());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a shortcut', () => {
    result.current.register({
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock1,
    });

    fireEvent.keyDown(document.body, { code: 'KeyS', ctrlKey: true });

    expect(handlerMock1).toHaveBeenCalled();
  });

  it('should unregister a shortcut', () => {
    const handlerMock = vi.fn();

    result.current.register({
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock,
    });

    fireEvent.keyDown(document.body, { code: 'KeyS', ctrlKey: true });

    result.current.unRegister({
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock,
    });

    fireEvent.keyDown(document.body, { code: 'KeyS', ctrlKey: true });

    expect(handlerMock).toHaveBeenCalledTimes(1);
  });

  it('should not register the same shortcut twice', () => {
    const handlerMock = vi.fn();

    result.current.register({
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock,
    });

    result.current.register({
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock,
    });

    fireEvent.keyDown(document.body, { code: 'KeyS', ctrlKey: true });

    expect(handlerMock).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple shortcuts', () => {
    result.current.register({
      code: 'KeyS',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock1,
    });

    result.current.register({
      code: 'KeyV',
      optionalKeys: { ctrlKey: true },
      handler: handlerMock2,
    });

    fireEvent.keyDown(document.body, { code: 'KeyS', ctrlKey: true });
    fireEvent.keyDown(document.body, { code: 'KeyV', ctrlKey: true });

    expect(handlerMock1).toHaveBeenCalled();
    expect(handlerMock2).toHaveBeenCalled();
  });
});
