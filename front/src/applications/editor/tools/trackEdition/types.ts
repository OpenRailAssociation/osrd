import { Feature, Point, LineString } from 'geojson';

import { EditorEntity } from 'applications/editor/typesEditorEntity';
import { CommonToolState } from 'applications/editor/tools/types';

import type { DirectionalTrackRange, LoadingGaugeType } from 'common/api/osrdEditoastApi';
import { LinearMetadataItem } from 'common/IntervalsDataViz/types';

export type { DirectionalTrackRange as TrackRange };

export type TrackSectionEntity = EditorEntity<
  LineString,
  {
    length: number;
    slopes: LinearMetadataItem<{ gradient: number }>[];
    loading_gauge_limits: LinearMetadataItem<{ category: LoadingGaugeType }>[];
    curves: LinearMetadataItem<{ radius: number }>[];
    extensions?: {
      sncf?: {
        line_code?: number;
        line_name?: string;
        track_name?: string;
        track_number?: number;
      };
    };
  }
> & {
  objType: 'TrackSection';
};

export type TrackEditionState = CommonToolState & {
  track: TrackSectionEntity;
  initialTrack: TrackSectionEntity;

  editionState:
    | { type: 'addPoint' }
    | { type: 'movePoint'; draggedPointIndex?: number; hoveredPointIndex?: number }
    | { type: 'deletePoint'; hoveredPointIndex?: number };

  // Anchoring state:
  anchorLinePoints: boolean;
  addNewPointsAtStart: boolean;
  nearestPoint: Feature<Point> | null;
};
