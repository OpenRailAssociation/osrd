import { Context, createContext } from 'react';

import { EditorContextType } from './tools/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/prefer-default-export
export const EditorContext = createContext<EditorContextType<any> | null>(null) as Context<
  EditorContextType<any>
>;
/* eslint-enable @typescript-eslint/no-explicit-any */
