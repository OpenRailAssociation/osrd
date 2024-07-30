import type { Layer } from 'applications/editor/consts';
import type { EditorState } from 'reducers/editor';

export default function editorTestDataBuilder() {
  return {
    buildEditorLayers: (layers: Array<Layer>): EditorState['editorLayers'] => new Set(layers),
    buildEditorSchema: (): EditorState['editorSchema'] => [
      { layer: 'layerA', objType: 'BufferStop', schema: {} },
      { layer: 'layerA', objType: 'Route', schema: {} },
      { layer: 'layerA', objType: 'TrackNodeType', schema: {} },
    ],
    buildTotalIssue: (
      total: EditorState['issues']['total'],
      filterTotal: EditorState['issues']['filterTotal']
    ): Pick<EditorState['issues'], 'total' | 'filterTotal'> => ({
      total,
      filterTotal,
    }),
    buildFilterIssue: (
      filterLevel: EditorState['issues']['filterLevel'],
      filterType: EditorState['issues']['filterType']
    ): Pick<EditorState['issues'], 'filterLevel' | 'filterType'> => ({
      filterLevel,
      filterType,
    }),
  };
}
