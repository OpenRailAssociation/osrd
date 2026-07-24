import { useEffect, type RefObject } from 'react';

import type { Feature, FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import { Source, useMap } from 'react-map-gl/maplibre';

import { OrderedLayer } from 'common/Map/Layers';
import { LAYER_GROUPS, LAYER_GROUPS_ORDER } from 'config/layerOrder';
import { linearColorScaleInterpolation } from 'utils/color';
import { linearScaleInterpolation } from 'utils/numbers';

import type { StdcmProgressPoint, StdcmProgressPoints } from '../types';

type AnimationTheme = {
  inner: string;
  outer: string;
}[];
const THEME_NORMAL: AnimationTheme = [
  { inner: 'rgb(79, 63, 225)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgb(79, 63, 225)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgba(0, 73, 255, 0.9)', outer: 'rgba(72, 69, 227, 1)' },
  { inner: 'rgba(0, 129, 255, 0.7)', outer: 'rgba(0, 129, 255, 0.5)' },
  { inner: 'rgba(90, 180, 234, 0.78)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgba(112, 193, 229, 0.8)', outer: 'rgb(0, 0, 0)' },
];

const THEME_UPSTREAM: AnimationTheme = [
  { inner: 'rgb(200, 63, 225)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgb(200, 63, 225)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgba(200, 73, 255, 0.9)', outer: 'rgba(200, 69, 227, 1)' },
  { inner: 'rgba(200, 129, 255, 0.7)', outer: 'rgba(200, 129, 255, 0.5)' },
  { inner: 'rgba(200, 180, 234, 0.78)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgba(200, 193, 229, 0.8)', outer: 'rgb(0, 0, 0)' },
];
const THEME_DOWNSTREAM: AnimationTheme = [
  { inner: 'rgb(100, 63, 225)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgb(100, 63, 225)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgba(100, 73, 255, 0.9)', outer: 'rgba(100, 69, 227, 1)' },
  { inner: 'rgba(100, 129, 255, 0.7)', outer: 'rgba(100, 129, 255, 0.5)' },
  { inner: 'rgba(100, 180, 234, 0.78)', outer: 'rgb(0, 0, 0)' },
  { inner: 'rgba(100, 193, 229, 0.8)', outer: 'rgb(0, 0, 0)' },
];

type AnimationDef = Array<{
  timeRange: { min: number; max: number };
  pointToGeojson: (point: StdcmProgressPoint, elapsedTime: number) => Feature<Point>;
}>;

function getAnimationDefinition(theme: AnimationTheme): AnimationDef {
  // Defining the animation steps with the given theme.
  const animationSteps = [
    {
      time: 0,
      innerCircleColor: theme[0].inner,
      innerCircleSize: 0,
      innerCircleBorder: 0,
      outerCircleColor: theme[0].outer,
      outerCircleSize: 0,
      outerCircleBorder: 0,
    },
    {
      time: 33,
      innerCircleColor: theme[1].inner,
      innerCircleSize: 3,
      innerCircleBorder: 2,
      outerCircleColor: theme[1].outer,
      outerCircleSize: 0,
      outerCircleBorder: 0,
    },
    {
      time: 100,
      innerCircleColor: theme[2].inner,
      innerCircleSize: 7,
      innerCircleBorder: 5,
      outerCircleColor: theme[2].outer,
      outerCircleSize: 13,
      outerCircleBorder: 2,
    },
    {
      time: 825,
      innerCircleColor: theme[3].inner,
      innerCircleSize: 6,
      innerCircleBorder: 4,
      outerCircleColor: theme[3].outer,
      outerCircleSize: 17,
      outerCircleBorder: 2,
    },
    {
      time: 1750,
      innerCircleColor: theme[4].inner,
      innerCircleSize: 4.5,
      innerCircleBorder: 2,
      outerCircleColor: theme[4].outer,
      outerCircleSize: 0,
      outerCircleBorder: 0,
    },
    {
      time: 2000,
      innerCircleColor: theme[5].inner,
      innerCircleSize: 4,
      innerCircleBorder: 1,
      outerCircleColor: theme[5].outer,
      outerCircleSize: 0,
      outerCircleBorder: 0,
    },
  ];

  // Between each animation step we need to do a linear interpolation.
  // For each range, we create a function that transform a point to a the geojson with the good style variables.
  // The last range is from the last step time to infinity and should return a static value (animation is finished).
  return animationSteps.map((curr, index) => {
    // Special case for the latest step,
    if (index === animationSteps.length - 1) {
      return {
        timeRange: { min: curr.time, max: Infinity },
        pointToGeojson: (point) => ({
          type: 'Feature',
          properties: animationSteps[animationSteps.length - 1],
          geometry: point.geoPoint,
        }),
      };
    }

    const next = animationSteps[index + 1];
    const timeRange = {
      min: curr.time,
      max: next.time,
    };
    return {
      timeRange,
      pointToGeojson: (point, elapsedTime) => ({
        type: 'Feature',
        properties: {
          innerCircleColor: linearColorScaleInterpolation(
            { from: curr.innerCircleColor, to: next.innerCircleColor },
            timeRange,
            elapsedTime
          ),
          innerCircleSize: linearScaleInterpolation(
            { from: curr.innerCircleSize, to: next.innerCircleSize },
            timeRange,
            elapsedTime
          ),
          innerCircleBorder: linearScaleInterpolation(
            { from: curr.innerCircleBorder, to: next.innerCircleBorder },
            timeRange,
            elapsedTime
          ),
          outerCircleColor: linearColorScaleInterpolation(
            { from: curr.outerCircleColor, to: next.outerCircleColor },
            timeRange,
            elapsedTime
          ),
          outerCircleSize: linearScaleInterpolation(
            { from: curr.outerCircleSize, to: next.outerCircleSize },
            timeRange,
            elapsedTime
          ),
          outerCircleBorder: linearScaleInterpolation(
            { from: curr.outerCircleBorder, to: next.outerCircleBorder },
            timeRange,
            elapsedTime
          ),
        },
        geometry: point.geoPoint,
      }),
    };
  });
}

const ANIMATIONS_BY_THEME: Record<StdcmProgressPoint['type'], AnimationDef> = {
  downstream: getAnimationDefinition(THEME_DOWNSTREAM),
  normal: getAnimationDefinition(THEME_NORMAL),
  upstream: getAnimationDefinition(THEME_UPSTREAM),
};

/**
 * React Map layer component that display the progress of the stdcm path finding algo.
 */
const StdcmMapProgressLayer = ({
  progressPoints,
}: {
  progressPoints: RefObject<StdcmProgressPoints>;
}) => {
  const mapRef = useMap();

  useEffect(() => {
    const map = mapRef.current?.getMap();

    let timeoutId: null | number = null;
    const animate = () => {
      if (!map) return;
      const source = map.getSource<GeoJSONSource>('stdcm-algo-progress');
      if (!source) return;

      const data: FeatureCollection = {
        type: 'FeatureCollection',
        features: progressPoints.current.map((point) => {
          // Point timestamp can be in the futur. If so its delta time is O except if it override a previous point
          // In this case it takes the max animation value
          const deltaTime = Date.now() - point.animationStartTime;
          const elapsedTime = Math.max(0, deltaTime);
          const animation = ANIMATIONS_BY_THEME[point.type].find(
            (a) => a.timeRange.min <= elapsedTime && elapsedTime < a.timeRange.max
          )!;
          return animation.pointToGeojson(point, elapsedTime);
        }),
      };
      source.setData(data);
      timeoutId = window.setTimeout(animate, 0);
    };
    timeoutId = window.setTimeout(animate, 0);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [progressPoints, mapRef]);

  return (
    <Source
      id="stdcm-algo-progress"
      type="geojson"
      data={{
        type: 'FeatureCollection',
        features: [],
      }}
    >
      <OrderedLayer
        id="stdcm-algo-progress-outer"
        type="circle"
        layerOrder={LAYER_GROUPS_ORDER[LAYER_GROUPS.OVER_PUNCTUAL]}
        paint={{
          'circle-radius': ['get', 'outerCircleSize'],
          'circle-color': 'rgba(255, 255, 255, 0)',
          'circle-stroke-width': ['get', 'outerCircleBorder'],
          'circle-stroke-color': ['get', 'outerCircleColor'],
        }}
      />
      <OrderedLayer
        id="stdcm-algo-progress-inner"
        type="circle"
        layerOrder={LAYER_GROUPS_ORDER[LAYER_GROUPS.OVER_PUNCTUAL]}
        paint={{
          'circle-radius': ['get', 'innerCircleSize'],
          'circle-color': ['get', 'innerCircleColor'],
          'circle-stroke-width': ['get', 'innerCircleBorder'],
          'circle-stroke-color': '#FFF',
        }}
      />
    </Source>
  );
};

export default StdcmMapProgressLayer;
