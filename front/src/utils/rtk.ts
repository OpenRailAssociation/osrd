import type {
  MutationDefinition,
  OverrideResultType,
  QueryDefinition,
} from '@reduxjs/toolkit/query';

export type OverrideQueryArgType<Definition, NewQueryArgType> =
  Definition extends QueryDefinition<
    any,
    infer BaseQuery,
    infer TagTypes,
    infer ResultType,
    infer ReducerPath
  >
    ? QueryDefinition<NewQueryArgType, BaseQuery, TagTypes, ResultType, ReducerPath>
    : Definition extends MutationDefinition<
          NewQueryArgType,
          infer BaseQuery,
          infer TagTypes,
          infer ResultType,
          infer ReducerPath
        >
      ? MutationDefinition<NewQueryArgType, BaseQuery, TagTypes, ResultType, ReducerPath>
      : never;

export type OverrideQueryArgResultType<Definition, NewQueryArgType, NewResultType> =
  OverrideQueryArgType<OverrideResultType<Definition, NewResultType>, NewQueryArgType>;

export type PartiallyOverride<Type, Find, Repl> = {
  [K in keyof Type]: Type[K] extends Find
    ? Omit<PartiallyOverride<Type[K], Find, Repl>, keyof Repl> & Repl
    : PartiallyOverride<Type[K], Find, Repl>;
};
