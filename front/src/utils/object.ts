/* eslint-disable import/prefer-default-export */
import { isEqual, pick } from 'lodash';
/**
  compare two objects based on a list of keys
 */
export const partialIsEqual = (keys: string[], a: object, b: object) =>
  isEqual(pick(a, keys), pick(b, keys));
