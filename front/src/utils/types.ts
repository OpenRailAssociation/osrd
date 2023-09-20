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

export type ArrayElementKeys<T> = T extends (infer U)[] ? keyof U : null;

export type typedEntries<T> = Array<[keyof T, T[keyof T]]>;

export type Intersection<T, U> = {
  [K in keyof T & keyof U]: K extends keyof T & keyof U ? T[K] : never;
};
