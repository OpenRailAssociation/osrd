import { Context, createContext } from 'react';

import { EditorContextType } from './tools/types';

const EditorContext = createContext<EditorContextType | null>(null) as Context<EditorContextType>;

export default EditorContext;
