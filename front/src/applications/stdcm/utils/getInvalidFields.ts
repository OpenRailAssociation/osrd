import { consistErrorFields } from '../consts';
import type { ConsistErrors, InvalidFields } from '../types';

const getInvalidFields = (consistErrors: ConsistErrors[]): InvalidFields[] => {
  const seen = new Set<string>();
  return consistErrors.flatMap((errors) =>
    consistErrorFields.reduce<InvalidFields[]>((acc, key) => {
      const fieldError = errors[key];

      if (
        fieldError?.type === 'invalid' &&
        fieldError.display &&
        fieldError.message &&
        !seen.has(key)
      ) {
        seen.add(key);
        acc.push({ fieldName: key });
      }

      return acc;
    }, [])
  );
};

export default getInvalidFields;
