import type { Point } from 'geojson';

import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { OperationalPoint } from 'common/api/osrdEditoastApi';
import type { NullGeometry } from 'types';

export type OpEntity = EditorEntity<
  // TODO
  // All parts are displayed, but Editoast's objects endpoint is outdated, and
  // only returns one arbitrary part's point (or null without parts)
  Point | NullGeometry,
  OperationalPoint
> & {
  objType: 'OperationalPoint';
};
