import type { Point, Feature } from 'geojson';

export interface TrainPosition {
  id: string;
  trainId: number;
  headPosition: Feature<Point>;
  tailPosition: Feature<Point>;
  headDistanceAlong: number;
  tailDistanceAlong: number;
  speedTime: {
    speed: number;
    time: Date;
  };
  trainLength: number;
}
