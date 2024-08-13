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

export type RangedValue = {
  begin: number;
  end: number;
  value: string;
};
