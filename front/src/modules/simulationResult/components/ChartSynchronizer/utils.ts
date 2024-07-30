/* eslint-disable import/prefer-default-export */
import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type { RollingStock } from 'common/api/osrdEditoastApi';
import { isoDateWithTimezoneToSec } from 'utils/date';
import { mmToM } from 'utils/physics';

import { ChartSynchronizerV2, type ChartSynchronizerTrainData } from './ChartSynchronizerV2';
import { sec2d3datetime } from '../ChartHelpers/ChartHelpers';

export const updateChartSynchronizerV2TrainData = (
  simulation: SimulationResponseSuccess,
  rollingStock: RollingStock,
  departureTime: string
) => {
  const baseHeadPositions: { time: Date; position: number }[] = [];
  const baseTailPositions: { time: Date; position: number }[] = [];
  const baseSpeeds: { time: Date; position: number; speed: number }[] = [];
  simulation.base.positions.forEach((positionInMM, index) => {
    const position = mmToM(positionInMM);

    // TODO GET v2 : probably remove this conversion as trains will travel on several days
    // The chart time axis is set by d3 function *sec2d3datetime* which start the chart at 01/01/1900 00:00:00
    // As javascript new Date() util takes count of the minutes lost since 1/1/1900 (9min and 21s), we have
    // to use sec2d3datetime here as well to set the times on the chart
    const time = sec2d3datetime(
      isoDateWithTimezoneToSec(departureTime) + simulation.base.times[index] / 1000
    );
    if (!time) {
      return;
    }

    baseHeadPositions.push({ position, time });
    baseTailPositions.push({
      position: position - rollingStock.length,
      time,
    });
    baseSpeeds.push({
      position,
      time,
      speed: simulation.base.speeds[index],
    });
  });

  const marginSpeeds: { time: Date; position: number; speed: number }[] = [];
  const ecoHeadPositions: { time: Date; position: number }[] = [];
  const ecoTailPositions: { time: Date; position: number }[] = [];
  const ecoSpeeds: { time: Date; position: number; speed: number }[] = [];
  simulation.final_output.positions.forEach((positionInMM, index) => {
    const position = mmToM(positionInMM);

    // TODO GET v2 : probably remove this conversion as trains will travel on several days
    // The chart time axis is set by d3 function *sec2d3datetime* which start the chart at 01/01/1900 00:00:00
    // As javascript new Date() util takes count of the minutes lost since 1/1/1900 (9min and 21s), we have
    // to use sec2d3datetime here as well to set the times on the chart
    const time = sec2d3datetime(
      isoDateWithTimezoneToSec(departureTime) + simulation.final_output.times[index] / 1000
    );
    if (!time) {
      return;
    }

    marginSpeeds.push({
      position,
      time,
      speed: simulation.final_output.speeds[index],
    });
    ecoHeadPositions.push({ position, time });
    ecoTailPositions.push({
      position: position - rollingStock.length,
      time,
    });
    ecoSpeeds.push({
      position,
      time,
      speed: simulation.final_output.speeds[index],
    });
  });

  const chartSynchronizerData: ChartSynchronizerTrainData = {
    headPosition: baseHeadPositions,
    tailPosition: baseTailPositions,
    speed: baseSpeeds,
    margins_speed: marginSpeeds,
    eco_headPosition: ecoHeadPositions,
    eco_tailPosition: ecoTailPositions,
    eco_speed: ecoSpeeds,
  };

  ChartSynchronizerV2.getInstance().setTrainData(chartSynchronizerData);
};
