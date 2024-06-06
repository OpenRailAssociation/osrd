import { useRef, useEffect } from 'react';

import { CHART_AXES, LIST_VALUES } from 'modules/simulationResult/consts';
import type { PositionsSpeedTimes, SimulationTrain } from 'reducers/osrdsimulation/types';
import type { Store } from 'store';

import { interpolateOnTime } from '../ChartHelpers/ChartHelpers';

type PositionValues = PositionsSpeedTimes<Date>;
type Subscriber = (timePosition: Date, positionValues: PositionValues) => void;

/**
 * This singleton class allows components to subscribe to d3 data updates.
 * When notifyAll is called with new data, each subscriber will be called.
 * each function passed to @method subscribe will receive the new data.
 * subscriber functions can be used to refresh d3 graphes, or rehydrate react component with this data, now isolated from react life cycle.
 */
export class ChartSynchronizer {
  private static instance: ChartSynchronizer;

  private subscribers: Map<string, Subscriber>;

  private reduxStore: Store | undefined;

  timePosition: Date;

  positionValues: PositionValues;

  private constructor() {
    this.subscribers = new Map();
    this.timePosition = new Date();
    this.positionValues = {} as PositionValues;
  }

  static getInstance() {
    if (!ChartSynchronizer.instance) {
      ChartSynchronizer.instance = new ChartSynchronizer();
    }
    return ChartSynchronizer.instance;
  }

  setReduxStore(reduxStore: Store) {
    this.reduxStore = reduxStore;
  }

  subscribe(key: string, newSubscriber: Subscriber) {
    this.subscribers.set(key, newSubscriber);
  }

  unsubscribe(key: string) {
    this.subscribers.delete(key);
  }

  computePositionValues(newTrainId?: number) {
    if (!this.reduxStore) {
      throw new Error('Redux store reference was not set in Chart synchronizer');
    }
    const osrdSimulation = this.reduxStore.getState().osrdsimulation;
    const trainId = newTrainId || osrdSimulation.selectedTrainId;
    const currentTrainSimulation = osrdSimulation.consolidatedSimulation.find(
      (consolidatedSimulation: SimulationTrain) => consolidatedSimulation.id === trainId
    );
    this.positionValues = interpolateOnTime(
      currentTrainSimulation,
      CHART_AXES.SPACE_TIME,
      LIST_VALUES.SPACE_TIME
    )(this.timePosition) as PositionValues;
  }

  notifyAll(timePosition: Date) {
    this.timePosition = timePosition;
    this.computePositionValues();
    this.subscribers.forEach((sub) => {
      sub(timePosition, this.positionValues);
    });
  }
}

/**
 * @param subscriber – The function that is called to notify of the change
 * @param key – Each subscriber is identified by this key. useful to remove subscriber individually when component unmounts
 * @param dependencies – When a dependency changes, update the subscriber.
 * @returns
 */
export function useChartSynchronizer(
  subscriber?: Subscriber,
  key?: string,
  dependencies?: unknown[]
) {
  const synchronizer = useRef(ChartSynchronizer.getInstance());
  // create or update subscription
  useEffect(() => {
    if (subscriber && key && dependencies) {
      synchronizer.current.subscribe(key, subscriber);
      return () => {
        synchronizer.current.unsubscribe(key);
      };
    }
    return undefined;
  }, dependencies);
  return {
    timePosition: synchronizer.current.timePosition,
    positionValues: synchronizer.current.positionValues,
    updateTimePosition: synchronizer.current.notifyAll.bind(synchronizer.current),
  };
}
