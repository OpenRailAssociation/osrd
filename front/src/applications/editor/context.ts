import { Context, createContext } from 'react';
import { EditorContextType } from './tools/editorContextTypes';

const EditorContext = createContext<EditorContextType | null>(null) as Context<EditorContextType>;

export default EditorContext;
