export interface ILineSearchResult {
  line_code: number;
  line_name: string;
  infra_id: number;
}

export interface ISignalSearchResult {
  infra_id: number;
  label: string;
  aspects: string[];
  logical_types: string[];
  line_code: number;
  line_name: string;
  geographic: number[];
  schematic: number[];
}
