import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import {
  type TrainSchedule,
  type TrainScheduleWithPathRef,
} from 'applications/operationalStudies/types';
import type { Point } from './types';

export function seconds2hhmmss(seconds: number) {
  const dateTime = new Date(seconds * 1000);
  return dateTime.toJSON().substring(11, 19);
}

/**
 * Given a list of trainSchedules (some of them might take the same path), build
 * - a dictionnary of unique paths for these trainSchedules and add the path reference to each train
 * - a dictionnary of waypoints (the key of each waypoint is its uic) which will be used if
 *   users choose to complete the pathfindings themselves
 * - an array of trainSchedules with the reference of their path
 *
 * The reference of a path is a unique string (concatenation of its steps).
 */
export function refactorUniquePaths(
  trains: TrainSchedule[],
  setTrainsWithPathRef: (trainsWithPathRef: TrainScheduleWithPathRef[]) => void,
  setPathsDictionnary: (pathsDictionnary: { trainNumber: string; pathString: string }[]) => void,
  setPointsDictionnary: (pointsDictionnary: Record<string, Point>) => void
) {
  const pathsDictionnary: { trainNumber: string; pathString: string }[] = [];
  const trainsWithPathRef: Array<TrainSchedule & { pathRef: string }> = [];
  const pointsList: Record<string, Point> = {};

  trains.forEach((train) => {
    const pathString =
      train.steps
        .map((step, idx) =>
          idx === 0 || idx === train.steps.length - 1
            ? `${step.latitude}${step.longitude}`
            : `0${step.latitude}${step.longitude}`
        )
        .join() +
      rollingstockOpenData2OSRD[train.rollingStock as keyof typeof rollingstockOpenData2OSRD];

    const pathRef = pathsDictionnary.find((entry) => entry.pathString === pathString);

    if (pathRef === undefined) {
      pathsDictionnary.push({
        trainNumber: train.trainNumber,
        pathString,
      });
    }

    trainsWithPathRef.push({
      ...train,
      pathRef: pathRef ? pathRef.trainNumber : train.trainNumber,
    });

    train.steps.forEach((step) => {
      pointsList[step.uic] = {
        longitude: step.longitude,
        latitude: step.latitude,
        name: step.name,
      };
    });
  });

  setTrainsWithPathRef(trainsWithPathRef);
  setPathsDictionnary(pathsDictionnary);
  setPointsDictionnary(pointsList);
}
