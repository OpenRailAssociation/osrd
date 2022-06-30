import { Dispatch } from 'redux';
import { TFunction } from 'i18next';
import { ViewportProps } from 'react-map-gl';
import { ComponentType, Context, createContext } from 'react';

import { EditorState } from '../../reducers/editor';
// eslint-disable-next-line import/no-cycle
import { CommonToolState, Tool } from './tools/types';

export interface ModalProps<ArgumentsType, SubmitArgumentsType = Record<string, unknown>> {
  arguments: ArgumentsType;
  cancel: () => void;
  submit: (args: SubmitArgumentsType) => void;
}

export interface ModalRequest<ArgumentsType, SubmitArgumentsType> {
  component: ComponentType<ModalProps<ArgumentsType, SubmitArgumentsType>>;
  arguments: ArgumentsType;
  beforeCancel?: () => void;
  afterCancel?: () => void;
  beforeSubmit?: (args: SubmitArgumentsType) => void;
  afterSubmit?: (args: SubmitArgumentsType) => void;
}

export interface EditorContextType<S> {
  // Localisation:
  t: TFunction;

  // Modals management:
  modal: ModalRequest<unknown, unknown> | null;
  openModal: <ArgumentsType, SubmitArgumentsType>(
    request: ModalRequest<ArgumentsType, SubmitArgumentsType>
  ) => void;
  closeModal: () => void;

  // Tool logic:
  activeTool: Tool<S>;
  state: S;
  setState: (state: S) => void;

  // Switching tool:
  switchTool: <NewToolState extends CommonToolState>(
    tool: Tool<NewToolState>,
    state?: Partial<NewToolState>
  ) => void;
}

export interface ExtendedEditorContextType<S> extends EditorContextType<S> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: Dispatch<any>;
  editorState: EditorState;
  mapState: {
    mapStyle: string;
    viewport: ViewportProps;
  };
}

export type ReadOnlyEditorContextType<S> = Omit<
  ExtendedEditorContextType<S>,
  'setState' | 'openModal' | 'closeModal'
> & {
  editorState: EditorState;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const EditorContext = createContext<EditorContextType<any> | null>(null) as Context<
  EditorContextType<any>
>;
/* eslint-enable @typescript-eslint/no-explicit-any */
