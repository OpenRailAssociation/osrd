import { consistErrorFields } from '../consts';
import type { ConsistErrors, InvalidFields } from '../types';

const getInvalidFields = (consistErrors: ConsistErrors): InvalidFields[] =>
  consistErrorFields.reduce<InvalidFields[]>((acc, key) => {
    const fieldError = consistErrors[key];

    if (fieldError?.type === 'invalid' && fieldError.display && fieldError.message) {
      acc.push({ fieldName: key });
    }

    return acc;
  }, []);

export default getInvalidFields;
