import { Feature, Point } from 'geojson';

import { EditorEntity } from 'applications/editor/typesEditorEntity';
import { Layer } from 'applications/editor/consts';
import { CommonToolState } from 'applications/editor/tools/types';
import { NullGeometry } from 'types';

export type SignalingSystem = {
  next_signaling_systems?: Array<string | undefined>;
} & (
  | {
      signaling_system?: 'BAL';
      settings?: { Nf: 'true' | 'false' };
    }
  | {
      signaling_system?: 'BAPR';
      settings?: { Nf: 'true' | 'false'; distant: 'true' | 'false' };
    }
  | {
      signaling_system?: 'TVM';
      settings?: { is_430: 'true' | 'false' };
    }
);
export type SignalEntity = EditorEntity<
  Point | NullGeometry,
  {
    track?: string;
    position?: number;
    logical_signals?: SignalingSystem[];
    extensions: {
      sncf: {
        is_in_service?: boolean;
        is_lightable?: boolean;
        is_operational?: boolean;
        installation_type?: string;
      };
    };
  }
> & {
  objType: 'Signal';
};

export type BufferStopEntity<T extends Point | NullGeometry = Point | NullGeometry> = EditorEntity<
  T,
  { track?: string; position?: number }
> & {
  objType: 'BufferStop';
};

export type DetectorEntity<T extends Point | NullGeometry = Point | NullGeometry> = EditorEntity<
  T,
  { track?: string; position?: number }
> & {
  objType: 'Detector';
};

export type PointEditionState<E extends EditorEntity> = CommonToolState & {
  initialEntity: E;
  entity: E;
  objType: Layer;
  isHoveringTarget?: boolean;
  nearestPoint: {
    feature: Feature<Point>;
    trackSectionID: string;
    angle: number;
  } | null;
};
