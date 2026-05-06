import { type CSSProperties } from 'react';

export type Waypoint = {
  id: string;
  position: number; // in mm
  name?: string;
  secondaryCode?: string | null;
  weight?: number;
};

export type InteractiveWaypoint = Waypoint & {
  styles?: CSSProperties;
  onClick?: (waypointId: string) => void;
};

export type ProjectPathTrainResult = {
  id: string;
  name: string;
  spaceTimeCurves: {
    positions: number[]; // in mm
    times: number[]; // in seconds since the departure of the train
  }[];
  departureTime: Date;
};

export type ChartPoint = { time: number; position: number };
export type ChartPath = {
  id: string;
  label: string;
  color: string;
  points: { time: number; position: number }[];
};
