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

export type ArrayElement<ArrayType extends readonly unknown[] | undefined> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type typedEntries<T> = Array<[keyof T, T[keyof T]]>;

export type Unit = 'meters' | 'millimeters';
