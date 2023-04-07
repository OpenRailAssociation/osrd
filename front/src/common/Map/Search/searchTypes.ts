import { Geometry } from 'geojson';

export interface ILineSearchResult {
  line_code: number;
  line_name: string;
  infra_id: number;
}

export interface ISignalSearchResult {
  infra_id: number;
  label: string;
  aspects: string[];
  type: string;
  line_code: number;
  line_name: string;
  geographic: Geometry;
  schematic: Geometry;
}
