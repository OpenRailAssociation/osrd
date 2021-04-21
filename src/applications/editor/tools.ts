import { ComponentType } from 'react';
import { IconType } from 'react-icons/lib/esm/iconBase';
import { GiArrowCursor, MdPhotoSizeSelectSmall, MdShowChart } from 'react-icons/all';

import SelectZone from './components/tools/SelectZone';
import SelectItem from './components/tools/SelectItem';
import CreateLine from './components/tools/CreateLine';
import { EditorState } from '../../reducers/editor';

export interface Tool {
  tool: string;
  icon: IconType;
  mapComponent: ComponentType;
  labelTranslationKey: string;
  descriptionTranslationKeys: string[];
  isEnabled: (editorState: EditorState) => boolean;
}

export const TOOLS: Tool[] = [
  {
    // Zone selection:
    tool: 'select-zone',
    icon: MdPhotoSizeSelectSmall,
    labelTranslationKey: 'Editor.tools.select-zone.label',
    descriptionTranslationKeys: [
      'Editor.tools.select-zone.description-1',
      'Editor.tools.select-zone.description-2',
      'Editor.tools.select-zone.description-3',
    ],
    mapComponent: SelectZone,
    isEnabled() {
      return true;
    },
  },
  {
    // Item selection:
    tool: 'select-item',
    icon: GiArrowCursor,
    labelTranslationKey: 'Editor.tools.select-item.label',
    descriptionTranslationKeys: ['Editor.tools.select-item.description-1'],
    mapComponent: SelectItem,
    isEnabled(editorState: EditorState) {
      return !!editorState.editionZone;
    },
  },
  {
    // Create rails:
    tool: 'create-line',
    icon: MdShowChart,
    labelTranslationKey: 'Editor.tools.create-line.label',
    descriptionTranslationKeys: [
      'Editor.tools.create-line.description-1',
      'Editor.tools.create-line.description-2',
      'Editor.tools.create-line.description-3',
      'Editor.tools.create-line.description-4',
      'Editor.tools.create-line.description-5',
    ],
    mapComponent: CreateLine,
    isEnabled(editorState: EditorState) {
      return !!editorState.editionZone;
    },
  },
];
