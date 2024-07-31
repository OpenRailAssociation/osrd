/**
 * for example
 * interface HeadTailPositionSpeed {
 *   headPosition: PositionSpeedTime;
 *   tailPosition: PositionSpeedTime;
 *   speed: SpeedTime;
 * }
 * ValueOf<HeadTailPositionSpeed> = PositionSpeedTime | SpeedTime;
 */
export type ValueOf<T> = T[keyof T];

export type ArrayElement<ArrayType extends readonly unknown[] | undefined | null> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type typedEntries<T> = Array<[keyof T, T[keyof T]]>;

export type Unit = 'meters' | 'millimeters';

export const mapBy = <K extends keyof T, T>(items: T[] | undefined, key: K): Map<T[K], T> =>
  new Map(items?.map((item) => [item[key], item]));

export const concatMap = <K, V>(map1: Map<K, V>, map2: Map<K, V>) =>
  new Map([...map1.entries(), ...map2.entries()]);
