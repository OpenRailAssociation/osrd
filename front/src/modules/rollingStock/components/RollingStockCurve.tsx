import React, { useEffect, useMemo, useState } from 'react';

import { ResponsiveLine } from '@nivo/line';
import type { PointTooltipProps } from '@nivo/line';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { RollingStock, Comfort } from 'common/api/osrdEditoastApi';
import { COLORS } from 'modules/rollingStock/components/RollingStockSelector/consts/consts';
import { comfort2pictogram } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import { STANDARD_COMFORT_LEVEL, THERMAL_TRACTION_IDENTIFIER } from 'modules/rollingStock/consts';
import type { ParsedCurve, TransformedCurves } from 'modules/rollingStock/types';
import { geti18nKeyForNull } from 'utils/strings';

import { getCurveName } from '../helpers/curves';

// Format RollingStock Curves to NIVO format
const parseData = (
  label: string,
  color: string,
  curve: TransformedCurves['index']
): ParsedCurve => {
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
  curvesComfortList: Comfort[];
  comfortsStates: { [key: string]: boolean };
  onComfortsStatesChange: (comfort: string) => void;
}) {
  const { curvesComfortList, comfortsStates, onComfortsStatesChange } = props;

  return curvesComfortList.length > 1 ? (
    <span className="d-flex">
      {curvesComfortList.map((comfort) => (
        <span
          className={cx('curves-chart-legend-comfort-button', {
            active: comfortsStates[comfort],
          })}
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
  curves: ParsedCurve[];
  curvesVisibility: { [key: string]: boolean };
  onCurvesVisibilityChange: (id: string) => void;
  isOnEditionMode?: boolean;
  showPowerRestriction?: boolean;
}) {
  const {
    curves,
    curvesVisibility,
    onCurvesVisibilityChange,
    isOnEditionMode,
    showPowerRestriction,
  } = props;

  return (
    <span className="d-flex">
      {curves.map((curve) => (
        <span
          className="curves-chart-legend-item"
          style={curvesVisibility[curve.id] ? { borderColor: curve.color } : {}}
          key={`legend-${curve.id}`}
          role="button"
          tabIndex={0}
          onClick={() => onCurvesVisibilityChange(curve.id)}
        >
          {isOnEditionMode && showPowerRestriction && curve.power_restriction}
          {isOnEditionMode && !showPowerRestriction && curve.electrical_profile_level}
          {!isOnEditionMode && !showPowerRestriction && curve.mode}
          {curve.comfort !== STANDARD_COMFORT_LEVEL &&
            !isOnEditionMode &&
            comfort2pictogram(curve.comfort)}
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

function setupCurvesVisibility(
  data: TransformedCurves,
  previousCurvesVisibility: { [key: string]: boolean } = {}
) {
  const nextCurvesVisibility: { [key: string]: boolean } = {};
  Object.keys(data).forEach((id) => {
    nextCurvesVisibility[id] = id in previousCurvesVisibility ? previousCurvesVisibility[id] : true;
  });
  return nextCurvesVisibility;
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
  selectedElectricalParam,
}: {
  data: RollingStock['effort_curves']['modes'];
  curvesComfortList: Comfort[];
  isOnEditionMode?: boolean;
  showPowerRestriction?: boolean;
  hoveredElectricalParam?: string | null;
  selectedElectricalParam?: string | null;
}) {
  const { t, ready } = useTranslation(['rollingstock']);
  const mode2name = (mode: string) =>
    mode !== THERMAL_TRACTION_IDENTIFIER ? mode : t(THERMAL_TRACTION_IDENTIFIER);

  const transformedData = useMemo(() => {
    const transformedCurves: TransformedCurves = {};
    Object.keys(data).forEach((mode) => {
      const name = mode2name(mode);
      data[mode].curves.forEach((curve) => {
        const { comfort, electrical_profile_level, power_restriction_code } = curve.cond;
        if (comfort && electrical_profile_level !== undefined) {
          const curveName = getCurveName(
            name,
            comfort,
            electrical_profile_level,
            showPowerRestriction ? power_restriction_code : null,
            isOnEditionMode
          );
          transformedCurves[curveName] = {
            ...(curve.curve as { speeds: number[]; max_efforts: number[] }),
            mode: name,
            comfort,
            electricalProfile: electrical_profile_level,
            powerRestriction: power_restriction_code,
          };
        }
      });
    });
    return transformedCurves;
  }, [data]);

  const [curves, setCurves] = useState<ParsedCurve[]>([]);
  const [curvesToDisplay, setCurvesToDisplay] = useState(curves);
  const [comfortsStates, setComfortsStates] = useState(initialComfortsState(curvesComfortList));
  const [curvesVisibility, setCurvesVisibility] = useState(setupCurvesVisibility(transformedData));

  const formatTooltip = (tooltip: PointTooltipProps) => {
    const transformedCurve = transformedData[tooltip.point.serieId];
    const editionModeTooltipLabel =
      isOnEditionMode && showPowerRestriction
        ? geti18nKeyForNull(transformedCurve?.powerRestriction)
        : geti18nKeyForNull(transformedCurve?.electricalProfile);
    return (
      <div className="curves-chart-tooltip" style={{ borderColor: tooltip.point.color }}>
        {transformedCurve && (
          <div
            className="curves-chart-tooltip-head"
            style={{
              backgroundColor: tooltip.point.color,
              color: COLORS[tooltip.point.color as keyof typeof COLORS],
              borderColor: tooltip.point.color,
            }}
          >
            {isOnEditionMode ? editionModeTooltipLabel : transformedCurve.mode}
            <span className="ml-1" />
            {transformedCurve.comfort !== STANDARD_COMFORT_LEVEL && (
              <span className="curves-chart-tooltip-comfort">
                {comfort2pictogram(transformedCurve.comfort)}
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
    if (curves && curvesVisibility) {
      setCurvesToDisplay(curves.filter((curve) => curvesVisibility[curve.id]));
    }
  }, [curves, curvesVisibility]);

  useEffect(() => {
    if (isOnEditionMode) {
      setComfortsStates(initialComfortsState([curvesComfortList[0]]));
    } else {
      setComfortsStates(initialComfortsState(curvesComfortList));
    }
    setCurvesVisibility((prevCurvesVisibility) =>
      setupCurvesVisibility(transformedData, prevCurvesVisibility)
    );
  }, [transformedData, ready]);

  const changeComfortState = (comfort: string) => {
    const nextComfortsStatesState = { ...comfortsStates, [comfort]: !comfortsStates[comfort] };
    const nextCurves = getCurvesByComfortState(transformedData, nextComfortsStatesState).filter(
      (curve) => curvesVisibility[curve]
    );

    if (nextCurves.length > 0) {
      setComfortsStates(nextComfortsStatesState);
    }
  };

  const changeCurveVisibility = (id: string) => {
    const nextCurvesVisibility = { ...curvesVisibility, [id]: !curvesVisibility[id] };

    const nextCurves = getCurvesByComfortState(transformedData, comfortsStates).filter(
      (curve) => nextCurvesVisibility[curve]
    );

    if (nextCurves.length > 0) {
      setCurvesVisibility(nextCurvesVisibility);
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
          curvesVisibility={curvesVisibility}
          onCurvesVisibilityChange={changeCurveVisibility}
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
