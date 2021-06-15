import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import { Action } from 'redux';
import { GeoJSON, Position } from 'geojson';
import { JSONSchema7 } from 'json-schema';

//
//  Redux types
//
export type ThunkAction<T extends Action> = ReduxThunkAction<void, any, unknown, T>;

//
//  Geospatial types
//
export type Point = Position;
export type Bbox = [Point, Point];
export type Path = Array<Point>;

export interface RectangleZone {
  type: 'rectangle';
  points: [Point, Point];
}
export interface PolygonZone {
  type: 'polygon';
  points: Point[];
}
export type Zone = RectangleZone | PolygonZone;

//
//  Metadata types
//
type uuid = string;
type flags = string; // Should match /[01]{7}/
export type LineExtremity = Partial<{
  OP_id: uuid;
  V_nom: string; // should match /V\d+.*/
  id_pk: number;
  L_code: string; // should match /\d+/
  pk_sncf: string; // should match /\d+\+\d+/
  OP_id_voie: uuid;
  RLJDZ_sens: string; // should match /[CD]/
  OP_id_ligne: uuid;
  P_pkInterne: number;
  OP_id_localisation: uuid;
  OP_id_localisationpk: uuid;
  OP_id_relationjointdezone: uuid;
  OP_id_tronconditineraireofpk: uuid;
  OP_id_tronconditinerairevoie: uuid;
  OP_id_relationlocalisationjdz: uuid;
  id_circuitdevoie_CDV_extremites: number;
  id_localisation_L_localisationPk: number;
  id_relationjointdezone_RJDZ_localisations: number;
  id_installationfixelocalisee_IFL_localisations: number;
}>;
export type LineProperties = Partial<{
  default_id: number;
  id_lrs: number;
  OP_id_poste: uuid;
  OP_id_nyx_gare_G_postesId: number;
  OP_id_gare: uuid;
  RA_libelle: string;
  extremites: LineExtremity[];
  RA_libelle_poste: string;
  RA_libelle_gare: string;
  isVerifie: [];
  isReverifie: [];
  isValidSch: boolean;
  isValidGeo: boolean;
  flagInvalidSch: flags;
  flagInvalidGeo: flags;
  OP_id: uuid;
  isGeomSchFromLRS: boolean;
  isGeomGeoFromLRS: boolean;
  extremites_agg: string | null;
  OP_id_poste_metier: string | null;
  RA_libelle_poste_metier: string | null;
  table_responsable: string | null;
  last_midi_update: string; // ISO 8601 date
}>;
export interface Item {
  id: string;
  properties: Record<string, any>;
}
export type PositionnedItem = Item & {
  lng: number;
  lat: number;
};

// Notification type
export interface Notification {
  title?: string;
  text: string;
  date?: Date;
  type?: 'success' | 'error' | 'warning' | 'info';
}

//
// Editor actions
//
export interface EditorActionInsert {
  type: 'insert';
  layer: string;
  geometry: GeoJSON;
  properties: LineProperties;
}
export interface EditorActionUpdate {
  type: 'update';
  layer: string;
  id: number;
  geometry: GeoJSON;
}
export interface EditorActionDelete {
  type: 'delete';
  layer: string;
  id: number;
}

export type EditorAction = EditorActionInsert | EditorActionUpdate | EditorActionDelete;

// Editor data model definition
export type EditorComponentsDefintion = { [key: string]: JSONSchema7 };
export type EditorEntitiesDefinition = { [key: string]: Array<keyof EditorComponentDefintion> };

//
//  Misc
//
export type Theme = {
  [key: string]: { [key: string]: string };
};
