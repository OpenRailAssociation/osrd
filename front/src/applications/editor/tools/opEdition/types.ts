import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { NullGeometry } from 'types';

export type OpEntity = EditorEntity<
  NullGeometry,
  {
    name: string;
  }
> & {
  objType: 'OperationalPoint';
};

export type OpEditionState = CommonToolState & {
  // Common entity state for tools
  initialEntity?: OpEntity;
  entity: OpEntity;

  isComplete: boolean;
};
