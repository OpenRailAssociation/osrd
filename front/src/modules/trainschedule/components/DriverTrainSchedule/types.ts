export type OperationalPointWithTimeAndSpeed = {
  id: string | null;
  name: string | null;
  position: number;
  speed: number;
  time: number;
  duration: number;
  line_code: number | null;
  track_number: number | null;
  line_name: string | null;
  track_name: string | null;
  ch?: string | null;
};
