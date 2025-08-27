/**
 * for example
 * type HeadTailPositionSpeed = {
 *   headPosition: PositionSpeedTime;
 *   tailPosition: PositionSpeedTime;
 *   speed: SpeedTime;
 * };
 * ValueOf<HeadTailPositionSpeed> = PositionSpeedTime | SpeedTime;
 */
export type ValueOf<T> = T[keyof T];

export type ArrayElement<ArrayType extends readonly unknown[] | undefined | null> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Unit = 'meters' | 'millimeters';

export const mapBy = <K extends keyof T, T>(items: T[] | undefined, key: K): Map<T[K], T> =>
  new Map(items?.map((item) => [item[key], item]));

export const concatMap = <K, V>(map1: Map<K, V>, map2: Map<K, V>) =>
  new Map([...map1.entries(), ...map2.entries()]);

/**
 * Transform the provided keys of an object to be non-nullable.
 *
 * -? removes the optional modifier
 *
 * NonNullable removes the nullable modifier
 * @param Type The object type we want to transform
 * @param K The keys we want to make non-nullable
 * @example NonNullableObject<{ a?: string | null; b?: string; c?: string }, 'a' | 'c'> = { a: string; b?: string; c: string }
 */
type NonNullableObject<Type, K extends keyof Type> = {
  [Property in keyof Type as Property extends K ? Property : never]-?: NonNullable<Type[Property]>;
} & {
  [Property in keyof Type as Property extends K ? never : Property]: Type[Property];
};

/**
 * Shortcut type to pick some properties of an object and make some of them non-nullable.
 * @example PickAndNonNullableFields<{ a?: string | null; b?: string; c?: string }, 'a' | 'c', 'a'> = { a: string; c?: string }
 */
export type PickAndNonNullableFields<
  Type,
  PickKeys extends keyof Type,
  TransformKeys extends keyof Type,
> = NonNullableObject<Pick<Type, PickKeys>, Extract<TransformKeys, PickKeys>>;
