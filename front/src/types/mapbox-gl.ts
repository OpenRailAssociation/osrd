import {
  BackgroundLayer,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  HillshadeLayer,
  LineLayer,
  RasterLayer,
  SymbolLayer,
  SkyLayer,
} from 'mapbox-gl';

export type {
  MapboxGeoJSONFeature,
  MapLayerMouseEvent,
  AnyPaint,
  CirclePaint,
  LinePaint,
  SymbolPaint,
  SymbolLayout,
  Map as MapboxType,
  BackgroundLayer,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  HillshadeLayer,
  LineLayer,
  RasterLayer,
  SymbolLayer,
  SkyLayer,
  LngLat,
} from 'mapbox-gl';

export type AnyLayer =
  | BackgroundLayer
  | CircleLayer
  | FillExtrusionLayer
  | FillLayer
  | HeatmapLayer
  | HillshadeLayer
  | LineLayer
  | RasterLayer
  | SymbolLayer
  | SkyLayer;
