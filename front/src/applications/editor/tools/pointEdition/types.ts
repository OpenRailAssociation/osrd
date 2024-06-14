import type { Feature, Point } from 'geojson';

import type { Layer } from 'applications/editor/consts';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { NullGeometry } from 'types';

export type SignalingSystem = {
  next_signaling_systems: string[];
} & (
  | {
      signaling_system: 'BAL';
      settings: { Nf: 'true' | 'false' };
      default_parameters?: { jaune_cli: 'true' | 'false' };
      conditional_parameters: {
        on_route: string;
        parameters: { jaune_cli: 'true' | 'false' };
      }[];
    }
  | {
      signaling_system: 'BAPR';
      settings: { Nf: 'true' | 'false'; distant: 'true' | 'false' };
      default_parameters?: object;
      conditional_parameters: [];
    }
  | {
      signaling_system: 'TVM';
      settings: { is_430: 'true' | 'false'; Nf: 'true' | 'false' };
      default_parameters?: object;
      conditional_parameters: [];
    }
);

export type SignalingSystemForm = {
  next_signaling_systems: Array<string | undefined>;
  signaling_system: 'BAL' | 'BAPR' | 'TVM';
  settings?: { Nf?: 'true' | 'false'; distant?: 'true' | 'false'; is_430?: 'true' | 'false' };
  default_parameters?: { jaune_cli: 'true' | 'false' };
  conditional_parameters: {
    on_route?: string;
    parameters?: { jaune_cli: 'true' | 'false' };
  }[];
};

export type SignalEntity = EditorEntity<
  Point | NullGeometry,
  {
    track?: string;
    position?: number;
    logical_signals?: SignalingSystem[];
    extensions: {
      sncf: {
        kp?: string;
        label?: string;
        side?: string;
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
