import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import defineChart from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/defineChart';
import { defineLinear } from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import { GevPreparedata } from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/prepareData';
import { SPEED_SPACE_CHART_KEY_VALUES } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import drawBPCC from './DataTypeDisplay/DrawBPCC';
import { GraphProps } from '../../ChartManager';

export default function LinearChart({
  horizontalZoom,
  positionX,
  selectedTrainSimulation,
  timePosition,
}: GraphProps) {
  const [selfHorizontalZoom, setSelfhorizontalZoom] = useState<number>(1);
  const [selfPositionX, setSelfPositionX] = useState<number | undefined>(undefined);
  const [selfTimePosition, setSelfTimePosition] = useState<string | undefined>(undefined);
  const [selfSelectedTrain, setSelfSelectedTrain] = useState<GevPreparedata | undefined>(undefined);

  const chartRef = useRef(null);
  const LINEAR_CHART_ID = 'linearChart';
  const CHART_MIN_HEIGHT = 250;
  const [currentChart, setCurrentChart] = useState(undefined);

  const setSelfValues = (
    inithorizontalZoom: number,
    initpositionX: number,
    inittimePosition: string,
    initselectedTrain: GevPreparedata
  ) => {
    setSelfhorizontalZoom(inithorizontalZoom);
    setSelfPositionX(initpositionX);
    setSelfTimePosition(inittimePosition);
    setSelfSelectedTrain(initselectedTrain);
  };

  function createChart(
    CHART_ID: string,
    chart: any,
    resetChart: boolean,
    initialHeight: number,
    ref: React.MutableRefObject<any>,
    trainSimulationData: GevPreparedata,
    hasJustRotated: boolean
  ) {
    d3.select(`#${CHART_ID}`).remove();

    let scaleX;
    let scaleY;

    if (!chart || resetChart) {
      scaleX = defineLinear(
        (d3.max(trainSimulationData.speed, (speedObject) => speedObject.position) || 0) + 100
      );
      scaleY = defineLinear(
        (d3.max(trainSimulationData.speed, (speedObject) => speedObject.speed) || 0) + 50
      );
    } else {
      scaleX = !hasJustRotated ? chart.x : chart.y;
      scaleY = !hasJustRotated ? chart.y : chart.x;
    }

    const width =
      d3.select(`#container-${CHART_ID}`) !== null
        ? parseInt(d3.select(`#container-${CHART_ID}`)?.style('width'), 10)
        : 250;

    return defineChart(
      width,
      initialHeight,
      scaleX,
      scaleY,
      ref,
      false,
      SPEED_SPACE_CHART_KEY_VALUES,
      CHART_ID
    );
  }

  useEffect(() => {
    if (horizontalZoom && positionX && timePosition && selectedTrainSimulation) {
      setSelfValues(horizontalZoom, positionX, timePosition, selectedTrainSimulation);
    }
    if (selectedTrainSimulation) {
      createChart(
        LINEAR_CHART_ID,
        currentChart,
        false,
        CHART_MIN_HEIGHT,
        chartRef,
        selectedTrainSimulation,
        false
      );
    }

    // drawBPCC(data, chartRef.current);
  }, []);

  useEffect(() => {
    setSelfSelectedTrain(selectedTrainSimulation);
  }, [selectedTrainSimulation]);

  // useEffect(() => {
  //   if (data && chartRef.current) {
  //     drawBPCC(data, chartRef.current); // Pass the data as a parameter
  //   }
  // }, [data]);

  // return a chart with a line using d3
  return (
    <div id={`container-${LINEAR_CHART_ID}`} className="w-100">
      <div ref={chartRef} className="w-100" />
    </div>
  );
}
