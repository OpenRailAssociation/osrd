import React, { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line';
import PropTypes from 'prop-types';
import { COLORS } from './consts/consts';
import { comfort2pictogram } from './RollingStockHelpers';

// Format RollingStock Curves to NIVO format
const parseData = (label, color, curve) => {
  // Have to transform data, will change when we'll have multiples curves,
  // so initial transformation is commented :
  // const curveFormatted = curve.map((item)
  // => ({ x: item.speed * 3.6, y: item.max_effort / 1000 }));
  const curveFormatted = curve.speeds.map((speed, index) => ({
    x: speed * 3.6,
    y: curve.max_efforts[index] / 1000,
  }));

  const curveFormattedSorted = curveFormatted.sort((a, b) => (a.x > b.x ? 1 : -1));

  return {
    id: label,
    color,
    mode: curve.mode,
    comfort: curve.comfort,
    data: curveFormattedSorted,
  };
};

function LegendComfortSwitches(props) {
  const { curvesComfortList, comfortsStates, setComfortsStates } = props;
  const changeComfortState = (id) => {
    setComfortsStates({ ...comfortsStates, [id]: !comfortsStates[id] });
  };
  return curvesComfortList ? (
    <span className="d-flex">
      {curvesComfortList.map((comfort) => (
        <span
          className={`curves-chart-legend-comfort-button ${
            comfortsStates[comfort] ? 'active' : null
          }`}
          key={`comfortSwitch-${comfort}`}
          role="button"
          tabIndex={0}
          onClick={() => changeComfortState(comfort)}
        >
          {comfort2pictogram(comfort)}
        </span>
      ))}
    </span>
  ) : null;
}

function Legend(props) {
  const { curves, curvesState, setCurvesState } = props;
  const changeCurveState = (id) => {
    setCurvesState({ ...curvesState, [id]: !curvesState[id] });
  };

  return (
    <span className="d-flex">
      {curves.map((curve) => (
        <span
          className="curves-chart-legend-item"
          style={curvesState[curve.id] ? { borderColor: curve.color } : null}
          key={`legend-${curve.id}`}
          role="button"
          tabIndex={0}
          onClick={() => changeCurveState(curve.id)}
        >
          {curve.mode}
          {curve.comfort !== 'STANDARD' ? comfort2pictogram(curve.comfort) : null}
        </span>
      ))}
    </span>
  );
}

// Choose cyclic color for curves
function curveColor(index) {
  const indexShort = index % Object.keys(COLORS).length;
  return Object.keys(COLORS)[indexShort];
}

function initialCurvesState(data) {
  const curvesState = {};
  Object.keys(data).forEach((id) => {
    curvesState[id] = true;
  });
  return curvesState;
}

function initialComfortsState(data) {
  const comfortsState = {};
  data.forEach((id) => {
    comfortsState[id] = true;
  });
  return comfortsState;
}

export default function RollingStockCurve(props) {
  const { data, curvesComfortList } = props;
  const [curves, setCurves] = useState();
  const [curvesState, setCurvesState] = useState(initialCurvesState(data));
  const [curvesToDisplay, setCurvesToDisplay] = useState(curves);
  const [comfortsStates, setComfortsStates] = useState(initialComfortsState(curvesComfortList));

  const formatTooltip = (tooltip) => (
    <div className="curves-chart-tooltip" style={{ borderColor: tooltip.point.color }}>
      <div
        className="curves-chart-tooltip-head"
        style={{
          backgroundColor: tooltip.point.color,
          color: COLORS[tooltip.point.color],
          borderColor: tooltip.point.color,
        }}
      >
        {data[tooltip.point.serieId].mode}
        <span className="ml-1" />
        {data[tooltip.point.serieId].comfort !== 'STANDARD' ? (
          <span className="curves-chart-tooltip-comfort">
            {comfort2pictogram(data[tooltip.point.serieId].comfort)}
          </span>
        ) : null}
      </div>
      <div className="curves-chart-tooltip-body">
        {`${tooltip.point.data.y}kN ${Math.floor(tooltip.point.data.x)}km/h`}
      </div>
    </div>
  );

  useEffect(() => {
    if (data && comfortsStates) {
      setCurves(
        Object.keys(data)
          .map((name, index) => parseData(name, curveColor(index), data[name]))
          .filter((curve) => comfortsStates[curve.comfort])
      );
    }
  }, [data, comfortsStates]);

  useEffect(() => {
    if (curves && curvesState) {
      setCurvesToDisplay(curves.filter((curve) => curvesState[curve.id]));
    }
  }, [curves, curvesState]);

  return curves && curvesState && curvesToDisplay && comfortsStates ? (
    <div className="curves-container pt-1 pb-3">
      <div className="curves-chart-legend mr-2 mb-1">
        <LegendComfortSwitches
          curvesComfortList={curvesComfortList}
          comfortsStates={comfortsStates}
          setComfortsStates={setComfortsStates}
        />
        <Legend curves={curves} curvesState={curvesState} setCurvesState={setCurvesState} />
      </div>
      <ResponsiveLine
        data={curvesToDisplay}
        margin={{
          top: 5,
          right: 10,
          bottom: 50,
          left: 45,
        }}
        xScale={{
          type: 'linear',
          min: 'auto',
          max: 'auto',
        }}
        yScale={{
          type: 'linear',
          min: 0,
          max: 'auto',
        }}
        curve="linear"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          orient: 'bottom',
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'km/h',
          legendOffset: 36,
          legendPosition: 'middle',
        }}
        axisLeft={{
          orient: 'left',
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'kN',
          legendOffset: -40,
          legendPosition: 'middle',
        }}
        colors={{ datum: 'color' }}
        lineWidth={2}
        enablePoints={false}
        useMesh
        tooltip={formatTooltip}
      />
    </div>
  ) : null;
}

LegendComfortSwitches.propTypes = {
  curvesComfortList: PropTypes.array.isRequired,
  comfortsStates: PropTypes.object.isRequired,
  setComfortsStates: PropTypes.func.isRequired,
};

Legend.propTypes = {
  curves: PropTypes.array.isRequired,
  curvesState: PropTypes.object.isRequired,
  setCurvesState: PropTypes.func.isRequired,
};

RollingStockCurve.propTypes = {
  data: PropTypes.object.isRequired,
  curvesComfortList: PropTypes.array.isRequired,
};
