import { Context, createContext } from 'react';

import { EditorContextType } from './tools/types';

export const EditorContext = createContext<EditorContextType | null>(
  null
) as Context<EditorContextType>;
