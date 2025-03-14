import {
  useState,
  useCallback,
  type FocusEvent,
  type KeyboardEvent,
  type FocusEventHandler,
  type KeyboardEventHandler,
} from 'react';

type UseFocusByTabProps = {
  onBlur?: FocusEventHandler<HTMLElement>;
  onKeyUp?: KeyboardEventHandler<HTMLElement>;
};

function useFocusByTab({ onBlur, onKeyUp }: UseFocusByTabProps) {
  const [isFocusByTab, setIsFocusByTab] = useState(false);

  const handleKeyUp = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Tab') setIsFocusByTab(true);
      onKeyUp?.(event);
    },
    [onKeyUp]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      setIsFocusByTab(false);
      onBlur?.(event);
    },
    [onBlur]
  );

  return { handleKeyUp, handleBlur, isFocusByTab };
}

export default useFocusByTab;
