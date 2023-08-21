import React, { useEffect, useState } from 'react';
import { PointTooltipProps, ResponsiveLine } from '@nivo/line';
import { useTranslation } from 'react-i18next';
import { Comfort, RollingStock } from 'common/api/osrdEditoastApi';
import { COLORS } from './consts/consts';
import { comfort2pictogram } from './RollingStockHelpers';

type EffortCurvesModes = RollingStock['effort_curves']['modes'];
type TransformedCurves = {
  [index: string]: {
    mode: string;
    comfort: Comfort;
    speeds: number[];
    max_efforts: number[];
  };
};
type ParsedCurves = {
  color: string;
  comfort: Comfort;
  data: {
    x: number;
    y: number;
  }[];
  id: string;
  mode: string;
};

// Format RollingStock Curves to NIVO format
const parseData = (
  label: string,
  color: string,
  curve: TransformedCurves['index']
): ParsedCurves => {
  // Have to transform data, will change when we'll have multiples curves,
  // so initial transformation is commented :
  // const curveFormatted = curve.map((item)
  // => ({ x: item.speed * 3.6, y: item.max_effort / 1000 }));

  const curveFormatted = curve.speeds.map((speed: number, index: number) => ({
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

function LegendComfortSwitches(props: {
  curvesComfortList: Comfort[];
  comfortsStates: { [key: string]: boolean };
  setComfortsStates: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}) {
  const { curvesComfortList, comfortsStates, setComfortsStates } = props;
  const changeComfortState = (comfort: string) => {
    setComfortsStates({ ...comfortsStates, [comfort]: !comfortsStates[comfort] });
  };

  return curvesComfortList.length > 1 ? (
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
  ) : (
    <span className="curves-chart-legend-comfort-button active">
      {comfort2pictogram(curvesComfortList[0])}
    </span>
  );
}

function Legend(props: {
  curves: ParsedCurves[];
  curvesState: { [key: string]: boolean };
  setCurvesState: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}) {
  const { curves, curvesState, setCurvesState } = props;
  const changeCurveState = (id: string) => {
    setCurvesState({ ...curvesState, [id]: !curvesState[id] });
  };

  return (
    <span className="d-flex">
      {curves.map((curve) => (
        <span
          className="curves-chart-legend-item"
          style={curvesState[curve.id] ? { borderColor: curve.color } : {}}
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
function curveColor(index: number) {
  const indexShort = index % Object.keys(COLORS).length;
  return Object.keys(COLORS)[indexShort];
}

function initialCurvesState(data: TransformedCurves) {
  const curvesState: { [key: string]: boolean } = {};
  Object.keys(data).forEach((id) => {
    curvesState[id] = true;
  });
  return curvesState;
}

function initialComfortsState(curvesComfortList: string[]) {
  const comfortsState: { [key: string]: boolean } = {};
  curvesComfortList.forEach((id) => {
    comfortsState[id] = true;
  });
  return comfortsState;
}

export default function RollingStockCurve({
  data,
  curvesComfortList,
  isOnEditionMode,
}: {
  data: EffortCurvesModes;
  curvesComfortList: Comfort[];
  isOnEditionMode?: boolean;
}) {
  const { t, ready } = useTranslation(['rollingstock']);
  const mode2name = (mode: string) => (mode !== 'thermal' ? `${mode}V` : t('thermal'));

  const transformCurves = (rollingStockCurves: EffortCurvesModes) => {
    const transformedCurves: TransformedCurves = {};
    Object.keys(rollingStockCurves).forEach((mode) => {
      // Standard curves (required)
      const name = mode2name(mode);
      transformedCurves[`${name} STANDARD`] = {
        ...(rollingStockCurves[mode].default_curve as TransformedCurves['index']),
        mode: name,
        comfort: 'STANDARD',
      };
      // AC & HEATING curves (optional)
      rollingStockCurves[mode].curves.forEach((curve) => {
        if (curve.cond?.comfort) {
          const optionalCurveName = `${name} ${curve.cond.comfort}`;
          transformedCurves[optionalCurveName] = {
            ...(curve.curve as TransformedCurves['index']),
            mode: name,
            comfort: curve.cond.comfort,
          };
        }
      });
    });
    return transformedCurves;
  };

  const [curves, setCurves] = useState<ParsedCurves[]>([]);
  const [curvesToDisplay, setCurvesToDisplay] = useState(curves);
  const transformedData = transformCurves(data);
  const [comfortsStates, setComfortsStates] = useState(initialComfortsState(curvesComfortList));
  const [curvesState, setCurvesState] = useState(initialCurvesState(transformedData));

  const formatTooltip = (tooltip: PointTooltipProps) => (
    <div className="curves-chart-tooltip" style={{ borderColor: tooltip.point.color }}>
      {transformedData[tooltip.point.serieId] && (
        <div
          className="curves-chart-tooltip-head"
          style={{
            backgroundColor: tooltip.point.color,
            color: COLORS[tooltip.point.color as keyof typeof COLORS],
            borderColor: tooltip.point.color,
          }}
        >
          {transformedData[tooltip.point.serieId].mode}
          <span className="ml-1" />
          {transformedData[tooltip.point.serieId].comfort !== 'STANDARD' && (
            <span className="curves-chart-tooltip-comfort">
              {comfort2pictogram(transformedData[tooltip.point.serieId].comfort)}
            </span>
          )}
        </div>
      )}
      <div className="curves-chart-tooltip-body">
        {`${tooltip.point.data.y}kN ${Math.floor(tooltip.point.data.x as number)}km/h`}
      </div>
    </div>
  );

  useEffect(() => {
    if (transformedData && comfortsStates) {
      setCurves(
        Object.keys(transformedData)
          .map((name, index) => parseData(name, curveColor(index), transformedData[name]))
          .filter((curve) => comfortsStates[curve.comfort])
      );
    }

    if (isOnEditionMode && curves[0] !== undefined) {
      setCurves(
        [Object.keys(transformedData)[0]]
          .map((name, index) => parseData(name, curveColor(index), transformedData[name]))
          .filter((curve) => comfortsStates[curve.comfort])
      );
    }
  }, [data, comfortsStates]);

  useEffect(() => {
    if (curves && curvesState) {
      setCurvesToDisplay(curves.filter((curve) => curvesState[curve.id]));
    }
  }, [curves, curvesState]);

  useEffect(() => {
    if (isOnEditionMode) {
      setComfortsStates(initialComfortsState([curvesComfortList[0]]));
    } else {
      setComfortsStates(initialComfortsState(curvesComfortList));
    }
    setCurvesState(initialCurvesState(transformedData));
  }, [data, ready]);

  return curves[0] !== undefined && curvesState && curvesToDisplay && comfortsStates ? (
    <div className="curves-container pt-1 pb-3">
      <div className="curves-chart-legend mr-2 mb-1">
        <LegendComfortSwitches
          curvesComfortList={isOnEditionMode ? [curvesComfortList[0]] : curvesComfortList}
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
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'km/h',
          legendOffset: 36,
          legendPosition: 'middle',
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'kN',
          legendOffset: -40,
          legendPosition: 'middle',
        }}
        colors={{ datum: 'color' }}
        lineWidth={2}
        useMesh
        tooltip={formatTooltip}
      />
    </div>
  ) : null;
}
