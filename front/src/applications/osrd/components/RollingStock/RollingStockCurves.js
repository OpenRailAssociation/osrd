import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { comfort2pictogram } from './RollingStockHelpers';
import { COLORS } from './consts/consts';

// Format RollingStock Curves to NIVO format
const parseData = (label, color, curve) => {
  // Have to transform data, will change when we'll have multiples curves,
  // so initial transformation is commented :
  // const curveFormatted = curve.map((item)
  // => ({ x: item.speed * 3.6, y: item.max_effort / 1000 }));
  const curveFormatted = curve.speeds.map((speed, index) => ({
    x: speed,
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

function DefaultCurveSwitch(props) {
  const { displayDefaultCurve, curvesComfortList, setDisplayDefaultCurve } = props;
  const { t } = useTranslation(['rollingstock']);
  return (
    <div className="rollingstock-defaultcurveswitch">
      <div className="custom-control custom-radio custom-control-inline">
        <input
          type="radio"
          id="defaultCurveChoice"
          name="defaultCurveChoice"
          className="custom-control-input"
          checked={displayDefaultCurve}
          onChange={() => setDisplayDefaultCurve(true)}
        />
        <label className="custom-control-label font-weight-medium" htmlFor="defaultCurveChoice">
          {t('curves.default')}
        </label>
      </div>
      {curvesComfortList.length > 1 ? (
        <div className="custom-control custom-radio custom-control-inline">
          <input
            type="radio"
            id="allCurvesChoice"
            name="allCurvesChoice"
            className="custom-control-input"
            checked={!displayDefaultCurve}
            onChange={() => setDisplayDefaultCurve(false)}
          />
          <label className="custom-control-label font-weight-medium" htmlFor="allCurvesChoice">
            {t('curves.all')} ({curvesComfortList.length})
          </label>
        </div>
      ) : null}
    </div>
  );
}

function Legend(props) {
  const { curves } = props;
  const { t } = useTranslation(['rollingstock']);
  return (
    <span className="d-flex">
      {curves.map((curve) => (
        <span
          className="curves-chart-legend-item ml-2"
          style={{ borderColor: curve.color }}
          key={`legend-${curve.id}`}
        >
          {curve.id === 'default' ? `${t('comfortTypes.standard')} (${curve.mode})` : curve.mode}
          {comfort2pictogram(curve.comfort)}
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

export default function RollingStockCurve(props) {
  const { data, displayDefaultCurve, curvesComfortList, setDisplayDefaultCurve } = props;
  const { t } = useTranslation(['rollingstock']);

  const curves = Object.keys(data).map((name, index) =>
    parseData(name, curveColor(index), data[name])
  );

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
        {tooltip.point.serieId === 'default'
          ? `${t('comfortTypes.standard')} (${data[tooltip.point.serieId].mode})`
          : data[tooltip.point.serieId].mode}
        <span className="ml-1" />
        {data[tooltip.point.serieId].comfort ? (
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

  return (
    <div className="curves-container py-3">
      <div className="curves-chart-legend mr-2 mb-1">
        <DefaultCurveSwitch
          displayDefaultCurve={displayDefaultCurve}
          setDisplayDefaultCurve={setDisplayDefaultCurve}
          curvesComfortList={curvesComfortList}
        />
        <Legend curves={curves} />
      </div>
      <ResponsiveLine
        data={curves}
        margin={{
          top: 5,
          right: 10,
          bottom: 50,
          left: 40,
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
          legendOffset: -30,
          legendPosition: 'middle',
        }}
        colors={{ datum: 'color' }}
        lineWidth={2}
        enablePoints={false}
        useMesh
        tooltip={formatTooltip}
      />
    </div>
  );
}

Legend.propTypes = {
  curves: PropTypes.array.isRequired,
};

DefaultCurveSwitch.defaultProps = {
  curvesComfortList: 1,
};
DefaultCurveSwitch.propTypes = {
  displayDefaultCurve: PropTypes.bool.isRequired,
  curvesComfortList: PropTypes.number,
  setDisplayDefaultCurve: PropTypes.func.isRequired,
};

RollingStockCurve.defaultProps = {
  curvesComfortList: 1,
};
RollingStockCurve.propTypes = {
  data: PropTypes.object.isRequired,
  displayDefaultCurve: PropTypes.bool.isRequired,
  curvesComfortList: PropTypes.number,
  setDisplayDefaultCurve: PropTypes.func.isRequired,
};
