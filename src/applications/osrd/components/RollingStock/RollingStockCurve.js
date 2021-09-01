import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import { BasicTooltip } from '@nivo/tooltip';
import PropTypes from 'prop-types';

const COLORS = ['#e05206', '#303383', '#6e1e78', '#a1006b', '#cd0037', '#e05206', '#ffb612', '#82be00', '#d2e100', '#009aa6', '#333'];

// Format GOC Curves to NIVO format
const parseData = (label, color, curve) => {
  const curveFormatted = curve.map((item) => ({ x: item.speed * 3.6, y: item.max_effort / 1000 }));

  const curveFormattedSorted = curveFormatted.sort(
    (a, b) => a.x > b.x,
  );

  return {
    id: label,
    color,
    data: curveFormattedSorted,
  };
};

// Choose cyclic color for curves
const curveColor = (index) => {
  const indexShort = index % COLORS.length;
  return COLORS[indexShort];
};

const formatTooltip = (props) => (
  <BasicTooltip
    id={`${props.point.data.y}kN`}
    value={`${Math.floor(props.point.data.x)}km/h`}
    color={props.point.color}
  />
);

export default function RollingStockCurve(props) {
  const { data } = props;
  const curves = Object.keys(data).map((name, index) => parseData(
    name, curveColor(index), data[name],
  ));

  return (
    <ResponsiveLine
      data={curves}
      margin={{
        top: 20,
        right: 20,
        bottom: 50,
        left: 55,
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
        legendOffset: -50,
        legendPosition: 'middle',
      }}
      colors={{ datum: 'color' }}
      lineWidth={2}
      enablePoints={false}
      useMesh
      tooltip={formatTooltip}
    />
  );
}

RollingStockCurve.propTypes = {
  data: PropTypes.object.isRequired,
};
