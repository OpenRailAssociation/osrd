export type ValueOf<T> = T[keyof T];

export type ArrayElement<ArrayType extends readonly unknown[] | undefined> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type ArrayElementKeys<T> = T extends (infer U)[] ? keyof U : null;
