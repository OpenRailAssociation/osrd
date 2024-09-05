import { useRef, useEffect } from 'react';

import { CHART_AXES, LIST_VALUES, type ListValues } from 'modules/simulationResult/consts';
import type { PositionsSpeedTimes } from 'reducers/osrdsimulation/types';

import { interpolateOnTime } from '../ChartHelpers/ChartHelpers';

type PositionValues = PositionsSpeedTimes<Date>;
type Subscriber = (timePosition: Date, positionValues: PositionValues) => void;

export type ChartSynchronizerTrainData = Partial<{ [Key in ListValues[number]]: unknown }>;

const IS_TRAIN_SCHEDULE_V2 = true;

/**
 * This singleton class allows components to subscribe to d3 data updates.
 * When notifyAll is called with new data, each subscriber will be called.
 * each function passed to @method subscribe will receive the new data.
 * subscriber functions can be used to refresh d3 graphes, or rehydrate react component with this data, now isolated from react life cycle.
 */
export class ChartSynchronizer {
  private static instance: ChartSynchronizer;

  private subscribers: Map<string, Subscriber>;

  timePosition: Date;

  positionValues: PositionValues;

  trainData?: ChartSynchronizerTrainData;

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

  setTrainData(trainData?: ChartSynchronizerTrainData) {
    this.trainData = trainData;
  }

  subscribe(key: string, newSubscriber: Subscriber) {
    this.subscribers.set(key, newSubscriber);
  }

  unsubscribe(key: string) {
    this.subscribers.delete(key);
  }

  computePositionValues() {
    if (this.trainData) {
      this.positionValues = interpolateOnTime(
        this.trainData,
        CHART_AXES.SPACE_TIME,
        LIST_VALUES.SPACE_TIME,
        IS_TRAIN_SCHEDULE_V2
      )(this.timePosition) as PositionValues;
    } else {
      this.positionValues = {} as PositionValues;
    }
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
