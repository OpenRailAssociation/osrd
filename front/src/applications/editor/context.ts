import { Context, createContext } from 'react';

import { EditorContextType } from './tools/types';

export const EditorContext = createContext<EditorContextType<any> | null>(null) as Context<
  EditorContextType<any>
>;
