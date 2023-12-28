import { isEqual } from 'lodash';

const useInputChange =
  <T>(
    initialValuesRef: React.MutableRefObject<T | null>,
    setCurrent: React.Dispatch<React.SetStateAction<T>>,
    setHasChanges: React.Dispatch<React.SetStateAction<boolean>>
  ) =>
  (field: keyof T, value: T[keyof T] | null | undefined) => {
    setCurrent((prevCurrent) => {
      const updated = {
        ...prevCurrent,
        [field]: value,
      };

      const hasValueChanged = !isEqual(updated, initialValuesRef.current);
      setHasChanges(hasValueChanged);

      return updated;
    });
  };

export default useInputChange;
