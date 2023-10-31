/**
 * for example
 * interface HeadTailPositionSpeed {
 *   headPosition: PositionSpeedTime;
 *   tailPosition: PositionSpeedTime;
 *   speed: SpeedTime;
 * }
 * GetObjectFieldsTypes<HeadTailPositionSpeed> = PositionSpeedTime | SpeedTime;
 */
export type ObjectFieldsTypes<T> = T[keyof T];

export type ArrayElement<ArrayType extends readonly unknown[] | undefined> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type typedEntries<T> = Array<[keyof T, T[keyof T]]>;
