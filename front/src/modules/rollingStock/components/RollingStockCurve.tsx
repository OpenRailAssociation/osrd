import React, { useEffect, useMemo, useState } from 'react';
import { PointTooltipProps, ResponsiveLine } from '@nivo/line';
import { useTranslation } from 'react-i18next';
import { RollingStockComfortType, RollingStock } from 'common/api/osrdEditoastApi';
import { useSelector } from 'react-redux';
import { getElectricalProfile, getPowerRestriction } from 'reducers/rollingstockEditor/selectors';
import { STANDARD_COMFORT_LEVEL, THERMAL_TRACTION_IDENTIFIER } from 'modules/rollingStock/consts';
import { geti18nKeyForNull } from 'utils/strings';
import { COLORS } from './RollingStockSelector/consts/consts';
import { comfort2pictogram } from './RollingStockSelector/RollingStockHelpers';

type EffortCurvesModes = RollingStock['effort_curves']['modes'];
type TransformedCurves = {
  [index: string]: {
    mode: string;
    comfort: RollingStockComfortType;
    speeds: number[];
    max_efforts: number[];
    electricalProfile: string | null;
    powerRestriction: string | null;
  };
};
type ParsedCurves = {
  color: string;
  comfort: RollingStockComfortType;
  data: {
    x: number;
    y: number;
  }[];
  id: string;
  mode: string;
  electrical_profile_level?: string | null;
  power_restriction?: string | null;
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
    electrical_profile_level: geti18nKeyForNull(curve.electricalProfile),
    power_restriction: geti18nKeyForNull(curve.powerRestriction),
  };
};

function LegendComfortSwitches(props: {
  curvesComfortList: RollingStockComfortType[];
  comfortsStates: { [key: string]: boolean };
  onComfortsStatesChange: (comfort: string) => void;
}) {
  const { curvesComfortList, comfortsStates, onComfortsStatesChange } = props;

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
          onClick={() => onComfortsStatesChange(comfort)}
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
  onCurvesStateChange: (id: string) => void;
  isOnEditionMode?: boolean;
  showPowerRestriction?: boolean;
}) {
  const { curves, curvesState, onCurvesStateChange, isOnEditionMode, showPowerRestriction } = props;

  return (
    <span className="d-flex">
      {curves.map((curve) => (
        <span
          className="curves-chart-legend-item"
          style={curvesState[curve.id] ? { borderColor: curve.color } : {}}
          key={`legend-${curve.id}`}
          role="button"
          tabIndex={0}
          onClick={() => onCurvesStateChange(curve.id)}
        >
          {isOnEditionMode && showPowerRestriction && curve.power_restriction}
          {isOnEditionMode && !showPowerRestriction && curve.electrical_profile_level}
          {!isOnEditionMode && !showPowerRestriction && curve.mode}
          {curve.comfort !== STANDARD_COMFORT_LEVEL && !isOnEditionMode
            ? comfort2pictogram(curve.comfort)
            : null}
        </span>
      ))}
    </span>
  );
}

const hoveredOpacityCode = 'B3'; // 70% opacity
const lowOpacityCode = '40'; // 25% opacity
const colorsListLength = Object.keys(COLORS).length;

/** Choose cyclic color for curves depending on curve number */
function curveColor(
  index: number,
  electricalReferenceForOpacity: string | null,
  hoveredElectricalParam?: string | null,
  selectedElectricalParam?: string | null
) {
  const indexShort = index % colorsListLength;
  if (hoveredElectricalParam) {
    const isHovered = electricalReferenceForOpacity === hoveredElectricalParam;
    const isSelected = electricalReferenceForOpacity === selectedElectricalParam;

    return `${Object.keys(COLORS)[indexShort]}${
      isHovered && !isSelected ? hoveredOpacityCode : ''
    }${!isHovered && !isSelected ? lowOpacityCode : ''}`;
  }
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

function getCurvesByComfortState(
  transformedData: TransformedCurves,
  comfortsStates: {
    [key: string]: boolean;
  }
) {
  return Object.keys(transformedData).filter(
    (curve) => comfortsStates[transformedData[curve].comfort]
  );
}

export default function RollingStockCurve({
  data,
  curvesComfortList,
  isOnEditionMode,
  showPowerRestriction,
  hoveredElectricalParam,
}: {
  data: EffortCurvesModes;
  curvesComfortList: RollingStockComfortType[];
  isOnEditionMode?: boolean;
  showPowerRestriction?: boolean;
  hoveredElectricalParam?: string | null;
}) {
  const { t, ready } = useTranslation(['rollingstock']);
  const mode2name = (mode: string) =>
    mode !== THERMAL_TRACTION_IDENTIFIER ? mode : t(THERMAL_TRACTION_IDENTIFIER);
  const selectedElectricalParam = useSelector(
    showPowerRestriction ? getPowerRestriction : getElectricalProfile
  );

  const transformedData = useMemo(() => {
    const transformedCurves: TransformedCurves = {};
    Object.keys(data).forEach((mode) => {
      const name = mode2name(mode);
      data[mode].curves.forEach((curve) => {
        if (curve.cond?.comfort && curve.cond?.electrical_profile_level !== undefined) {
          const electricalProfil = isOnEditionMode
            ? ` ${geti18nKeyForNull(curve.cond.electrical_profile_level)}`
            : '';
          const powerRestriction =
            showPowerRestriction && curve.cond.power_restriction_code
              ? ` ${geti18nKeyForNull(curve.cond.power_restriction_code)}`
              : '';
          const curveName = `${name} ${curve.cond.comfort}${electricalProfil}${powerRestriction}`;
          transformedCurves[curveName] = {
            ...(curve.curve as { speeds: number[]; max_efforts: number[] }),
            mode: name,
            comfort: curve.cond.comfort,
            electricalProfile: curve.cond.electrical_profile_level,
            powerRestriction: curve.cond.power_restriction_code as string,
          };
        }
      });
    });
    return transformedCurves;
  }, [data]);

  const [curves, setCurves] = useState<ParsedCurves[]>([]);
  const [curvesToDisplay, setCurvesToDisplay] = useState(curves);
  const [comfortsStates, setComfortsStates] = useState(initialComfortsState(curvesComfortList));
  const [curvesState, setCurvesState] = useState(initialCurvesState(transformedData));

  const formatTooltip = (tooltip: PointTooltipProps) => {
    const editionModeTooltipLabel =
      isOnEditionMode && showPowerRestriction
        ? geti18nKeyForNull(transformedData[tooltip.point.serieId]?.powerRestriction)
        : geti18nKeyForNull(transformedData[tooltip.point.serieId]?.electricalProfile);
    return (
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
            {isOnEditionMode
              ? editionModeTooltipLabel
              : transformedData[tooltip.point.serieId].mode}
            <span className="ml-1" />
            {transformedData[tooltip.point.serieId].comfort !== STANDARD_COMFORT_LEVEL && (
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
  };

  useEffect(() => {
    if (transformedData && comfortsStates) {
      setCurves(
        Object.keys(transformedData)
          .map((name, index) => {
            const electricalReferenceForOpacity = showPowerRestriction
              ? transformedData[name].powerRestriction
              : transformedData[name].electricalProfile;
            return parseData(
              name,
              curveColor(
                index,
                electricalReferenceForOpacity,
                hoveredElectricalParam,
                selectedElectricalParam
              ),
              transformedData[name]
            );
          })
          .filter((curve) => comfortsStates[curve.comfort])
      );
    }
  }, [transformedData, comfortsStates, hoveredElectricalParam, selectedElectricalParam]);

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
  }, [transformedData, ready]);

  const changeComfortState = (comfort: string) => {
    const nextComfortsStatesState = { ...comfortsStates, [comfort]: !comfortsStates[comfort] };
    const nextCurves = getCurvesByComfortState(transformedData, nextComfortsStatesState).filter(
      (curve) => curvesState[curve]
    );

    if (nextCurves.length > 0) {
      setComfortsStates(nextComfortsStatesState);
    }
  };

  const changeCurveState = (id: string) => {
    const nextCurvesState = { ...curvesState, [id]: !curvesState[id] };

    const nextCurves = getCurvesByComfortState(transformedData, comfortsStates).filter(
      (curve) => nextCurvesState[curve]
    );

    if (nextCurves.length > 0) {
      setCurvesState(nextCurvesState);
    }
  };

  return (
    <div className="rollingstock-curves">
      <div className="curves-chart-legend">
        <LegendComfortSwitches
          curvesComfortList={isOnEditionMode ? [curvesComfortList[0]] : curvesComfortList}
          comfortsStates={comfortsStates}
          onComfortsStatesChange={changeComfortState}
        />
        <Legend
          curves={curves}
          curvesState={curvesState}
          onCurvesStateChange={changeCurveState}
          isOnEditionMode={isOnEditionMode}
          showPowerRestriction={showPowerRestriction}
        />
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
  );
}
