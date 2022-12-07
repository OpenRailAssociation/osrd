import { Context, createContext } from 'react';

import { EditorContextType } from './tools/types';

// eslint-disable-next-line import/prefer-default-export
export const EditorContext = createContext<EditorContextType | null>(
  null
) as Context<EditorContextType>;
