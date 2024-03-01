import { type Context, createContext } from 'react';

import type { EditorContextType } from './types';

const EditorContext = createContext<EditorContextType | null>(null) as Context<EditorContextType>;

export default EditorContext;
