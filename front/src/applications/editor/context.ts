import { Dispatch } from 'redux';
import { TFunction } from 'i18next';
import { ViewportProps } from 'react-map-gl';
import { ComponentType, Context, createContext } from 'react';

import { EditorState } from '../../reducers/editor';
import { Tool } from './tools/types';

export interface ModalProps<ArgumentsType, SubmitArgumentsType = {}> {
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
}

export interface ExtendedEditorContextType<S> extends EditorContextType<S> {
  dispatch: Dispatch;
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

export const EditorContext = createContext<EditorContextType<unknown> | null>(null) as Context<
  EditorContextType<unknown>
>;
