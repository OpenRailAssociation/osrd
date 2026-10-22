import type { Feature, Point } from 'geojson';

import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import type { CommonToolState } from 'applications/editor/tools/types';
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

export type OpPartFeature = Feature<
  Point,
  {
    partIndex: number;
    track: string;
  }
>;

export type OpEditionState = CommonToolState & {
  initialEntity: OpEntity;
  entity: OpEntity;
  trackSectionsCache: Record<string, TrackState>;
  hoveredPartIndex: number | null;
  selectedPartIndex: number | null;
};
