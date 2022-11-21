import { AnyAction, Dispatch } from 'redux';
import * as d3 from 'd3';
import produce from 'immer';
import {
  LIST_VALUES_NAME_SPACE_TIME,
  SIGNAL_BASE_DEFAULT,
  KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
} from '../../applications/osrd/components/Simulation/consts';
import undoableSimulation, { REDO_SIMULATION, UNDO_SIMULATION } from './simulation';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';

import {
  interpolateOnTime,
  offsetSeconds,
  MergedDataPoint,
} from '../../applications/osrd/components/Helpers/ChartHelpers';
import { isNull } from 'lodash';

// Action Types
export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';
export const UPDATE_CHARTXGEV = 'osrdsimu/UPDATE_CHARTXGEV';
export const UPDATE_CONTEXTMENU = 'osrdsimu/UPDATE_CONTEXTMENU';
export const UPDATE_HOVER_POSITION = 'osrdsimu/UPDATE_HOVER_POSITION';
export const UPDATE_IS_PLAYING = 'osrdsimu/UPDATE_IS_PLAYING';
export const UPDATE_ALLOWANCES_SETTINGS = 'osrdsimu/UPDATE_ALLOWANCES_SETTINGS';
export const UPDATE_MUST_REDRAW = 'osrdsimu/UPDATE_MUST_REDRAW';
export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';
export const UPDATE_SELECTED_PROJECTION = 'osrdsimu/UPDATE_SELECTED_PROJECTION';
export const UPDATE_SELECTED_TRAIN = 'osrdsimu/UPDATE_SELECTED_TRAIN';
export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';
export const UPDATE_SIGNAL_BASE = 'osrdsimu/UPDATE_SIGNAL_BASE';
export const UPDATE_STICKYBAR = 'osrdsimu/UPDATE_STICKYBAR';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const UPDATE_TIME_POSITION_VALUES = 'osrdsimu/UPDATE_TIME_POSITION_VALUES';
export const UPDATE_CONSOLIDATED_SIMULATION = 'osrdsimu/UPDATE_CONSOLIDATED_SIMULATION';
export const UPDATE_DEPARTURE_ARRIVAL_TIMES = 'osrdsimu/UPDATE_DEPARTURE_ARRIVAL_TIMES';

export const makeDepartureArrivalTimes = (simulation: SimulationSnapshot, dragOffset: number) =>
  simulation.trains.map((train: Train) => ({
    labels: train.labels,
    name: train.name,
    departure: offsetSeconds(train.base.stops[0].time + dragOffset),
    arrival: offsetSeconds(train.base.stops[train.base.stops.length - 1].time + dragOffset),
    speed_limit_composition: train.speed_limit_composition,
  }));

export interface Chart {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  x: d3.ScaleTime<number, number>;
  xAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  xAxisGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  y: d3.ScaleLinear<number, number>;
  yAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  yAxisGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  drawZone: d3.Selection<SVGGElement, unknown, null, undefined>;
}
export interface AllowancesSetting {
  base: boolean;
  baseBlocks: boolean;
  eco: boolean;
  ecoBlocks: boolean;
}

export type AllowancesSettings = Record<string | number, AllowancesSetting>;

export interface Position<Time = number> {
  time: Time;
  position: number;
}
export type PositionSpeed<Time = number> = Position<Time> & {
  speed: number;
};

interface Stop {
  id: number;
  name: string;
  time: number;
  duration: number;
  position: number;
  line_code: number;
  track_number: number;
}

export interface RouteAspect<Time = number, Color = number> {
  signal_id: string;
  route_id: string;
  time_start: Time;
  time_end: Time;
  position_start: number;
  position_end: number;
  color: Color;
  blinking: boolean;
}

export interface SignalAspect<Time = number, Color = number> {
  signal_id: string;
  time_start: Time;
  time_end: Time;
  color: Color;
  blinking: boolean;
  aspect_label: string;
}

export interface Regime {
  head_positions: Position[][];
  tail_positions: Position[][];
  route_begin_occupancy: Position[][];
  route_end_occupancy: Position[][];
  speeds: PositionSpeed[];
  stops: Stop[];
  route_aspects: RouteAspect[];
  signal_aspects: SignalAspect[];
  error: any;
}

export interface Train {
  id: number;
  labels: any[];
  path: number;
  name: string;
  vmax: any[];
  slopes: any[];
  curves: any[];
  base: Regime;
  eco: Regime;
  isStdcm: boolean;
  margins: any;
  speed_limit_composition: string;
}

export interface SimulationSnapshot {
  trains: Train[];
}

export type SimulationHistory = SimulationSnapshot[];

export interface PositionValues {
  headPosition: PositionSpeed;
  tailPosition: PositionSpeed;
  routeEndOccupancy: number;
  routeBeginOccupancy: number;
  speed: {
    speed: number;
    time: number;
  };
}

export interface SimulationTrain {
  id: number;
  isStdcm: boolean;
  name: string;
  trainNumber: number;
  headPosition: Position<Date | null>[][];
  tailPosition: Position<Date | null>[][];
  routeEndOccupancy: Position<Date | null>[][];
  routeBeginOccupancy: Position<Date | null>[][];
  routeAspects: RouteAspect<Date | null, string>[];
  signalAspects: SignalAspect<Date | null, string>[];
  areaBlock: MergedDataPoint<Date | null>[][];
  speed: PositionSpeed<Date | null>[];
  eco_headPosition?: Position<Date | null>[][];
  eco_tailPosition?: Position<Date | null>[][];
  eco_routeEndOccupancy?: Position<Date | null>[][];
  eco_routeBeginOccupancy?: Position<Date | null>[][];
  eco_routeAspects?: RouteAspect<Date | null, string>[];
  eco_signalAspects?: SignalAspect<Date | null, string>[];
  eco_areaBlock?: MergedDataPoint<Date | null>[][];
  eco_speed?: PositionSpeed<Date | null>[];
}

export interface OsrdSimulationState {
  chart: any;
  chartXGEV: any;
  contextMenu: any;
  hoverPosition: any;
  isPlaying: boolean;
  allowancesSettings?: AllowancesSettings;
  mustRedraw: boolean;
  positionValues: PositionValues;
  selectedProjection: any;
  selectedTrain: number;
  speedSpaceSettings: {
    altitude: boolean;
    curves: boolean;
    maxSpeed: boolean;
    slopes: boolean;
  };
  stickyBar: boolean;
  signalBase: typeof SIGNAL_BASE_DEFAULT;
  timePosition: any;
  consolidatedSimulation: SimulationTrain[];
  departureArrivalTimes: Array<any>;
  displaySimulation: boolean;
  simulation: {
    past: SimulationHistory;
    present: SimulationSnapshot;
    future: SimulationHistory;
  };
}
// Reducer
export const initialState: OsrdSimulationState = {
  chart: undefined,
  chartXGEV: undefined,
  contextMenu: undefined,
  hoverPosition: undefined,
  isPlaying: false,
  allowancesSettings: undefined,
  mustRedraw: true,
  positionValues: {
    headPosition: {
      time: 0,
      position: 0,
      speed: 0,
    },
    tailPosition: {
      time: 0,
      position: 0,
      speed: 0,
    },
    routeEndOccupancy: 0,
    routeBeginOccupancy: 0,
    speed: {
      speed: 0,
      time: 0,
    },
  },
  selectedProjection: undefined,
  selectedTrain: 0,
  speedSpaceSettings: {
    altitude: false,
    curves: false,
    maxSpeed: true,
    slopes: false,
  },
  stickyBar: true,
  signalBase: SIGNAL_BASE_DEFAULT,
  timePosition: undefined,
  consolidatedSimulation: [],
  departureArrivalTimes: [],
  displaySimulation: false,
  simulation: {
    past: [],
    present: { trains: [] },
    future: [],
  },
};

// eslint-disable-next-line default-param-last
export default function reducer(inputState: OsrdSimulationState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    if (!state.simulation) draft.simulation = undoableSimulation(state.simulation, action);
    switch (action.type) {
      case UPDATE_CHART:
        draft.chart = action.chart;
        break;
      case UPDATE_CHARTXGEV:
        draft.chartXGEV = action.chartXGEV;
        break;
      case UPDATE_CONTEXTMENU:
        draft.contextMenu = action.contextMenu;
        break;
      case UPDATE_HOVER_POSITION:
        draft.hoverPosition = action.hoverPosition;
        break;
      case UPDATE_IS_PLAYING:
        draft.isPlaying = action.isPlaying;
        break;
      case UPDATE_ALLOWANCES_SETTINGS:
        draft.allowancesSettings = action.allowancesSettings;
        break;
      case UPDATE_MUST_REDRAW:
        draft.mustRedraw = action.mustRedraw;
        break;
      case UPDATE_POSITION_VALUES:
        draft.positionValues = action.positionValues;
        break;
      case UPDATE_SELECTED_PROJECTION:
        draft.selectedProjection = action.selectedProjection;
        break;
      case UPDATE_SELECTED_TRAIN:
        draft.selectedTrain = action.selectedTrain;
        break;
      case UPDATE_DEPARTURE_ARRIVAL_TIMES:
        draft.departureArrivalTimes = action.departureArrivalTimes;
        break;
      case UPDATE_SIMULATION:
      case UNDO_SIMULATION:
      case REDO_SIMULATION:
        // get only the present, thanks
        draft.simulation = undoableSimulation(state.simulation, action);
        draft.departureArrivalTimes = makeDepartureArrivalTimes(draft.simulation.present, 0);
        
        draft.consolidatedSimulation = createTrain(
          () => {},
          KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
          draft.simulation.present.trains,
          () => {}
        );
        draft.displaySimulation =
          draft.simulation.present?.trains.length > 0 &&
          draft.simulation.present.trains[state.selectedTrain] !== undefined;

        break;
      case UPDATE_SPEEDSPACE_SETTINGS:
        draft.speedSpaceSettings = action.speedSpaceSettings;
        break;
      case UPDATE_SIGNAL_BASE:
        draft.signalBase = action.signalBase;
        break;
      case UPDATE_STICKYBAR:
        draft.stickyBar = action.stickyBar;
        break;
      case UPDATE_TIME_POSITION:
        draft.timePosition = action.timePosition;
        break;
      case UPDATE_CONSOLIDATED_SIMULATION:
        draft.consolidatedSimulation = action.consolidatedSimulation;
        break;
      case UPDATE_TIME_POSITION_VALUES: {
        draft.timePosition = action.timePosition;
        // position value will be computed depending on current data simulation
        // eslint-disable-next-line no-case-declarations
        const currentTrainSimulation = state.consolidatedSimulation.find(
          (consolidatedSimulation: any) =>
            consolidatedSimulation.trainNumber === state.selectedTrain
        );
        const positionsValues = interpolateOnTime(
          currentTrainSimulation,
          ['time'],
          LIST_VALUES_NAME_SPACE_TIME,
          action.timePosition
        ) as any;
        draft.positionValues = positionsValues;
        break;
      }
      default:
        break;
    }
  });
}

// Functions
export function updateChart(chart: Chart) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CHART,
      chart,
    });
  };
}
export function updateChartXGEV(chartXGEV: OsrdSimulationState['chartXGEV']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CHARTXGEV,
      chartXGEV,
    });
  };
}
export function updateContextMenu(contextMenu: OsrdSimulationState['contextMenu']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CONTEXTMENU,
      contextMenu,
    });
  };
}
export function updateHoverPosition(hoverPosition: OsrdSimulationState['hoverPosition']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_HOVER_POSITION,
      hoverPosition,
    });
  };
}
export function updateIsPlaying(isPlaying: OsrdSimulationState['isPlaying']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_IS_PLAYING,
      isPlaying,
    });
  };
}
export function updateAllowancesSettings(
  allowancesSettings: OsrdSimulationState['allowancesSettings']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ALLOWANCES_SETTINGS,
      allowancesSettings,
    });
  };
}
export function updateMustRedraw(mustRedraw: OsrdSimulationState['mustRedraw']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_MUST_REDRAW,
      mustRedraw,
    });
  };
}
export function updatePositionValues(positionValues: OsrdSimulationState['positionValues']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_POSITION_VALUES,
      positionValues,
    });
  };
}
export function updateSelectedProjection(
  selectedProjection: OsrdSimulationState['selectedProjection']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_PROJECTION,
      selectedProjection,
    });
  };
}
export function updateSelectedTrain(selectedTrain: OsrdSimulationState['selectedTrain']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_TRAIN,
      selectedTrain,
    });
  };
}
export function updateSimulation(simulation: SimulationSnapshot) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}
export function updateSpeedSpaceSettings(
  speedSpaceSettings: OsrdSimulationState['speedSpaceSettings']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SPEEDSPACE_SETTINGS,
      speedSpaceSettings,
    });
  };
}
export function updateStickyBar(stickyBar: OsrdSimulationState['stickyBar']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_STICKYBAR,
      stickyBar,
    });
  };
}
export function updateSignalBase(signalBase: OsrdSimulationState['signalBase']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SIGNAL_BASE,
      signalBase,
    });
  };
}
export function updateTimePosition(timePosition: OsrdSimulationState['timePosition']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION,
      timePosition,
    });
  };
}
export function updateDepartureArrivalTimes(
  newDepartureArrivalTimes: OsrdSimulationState['departureArrivalTimes']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DEPARTURE_ARRIVAL_TIMES,
      departureArrivalTimes: newDepartureArrivalTimes,
    });
  };
}
export function updateConsolidatedSimulation(
  consolidatedSimulation: OsrdSimulationState['consolidatedSimulation']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CONSOLIDATED_SIMULATION,
      consolidatedSimulation,
    });
  };
}
export function updateTimePositionValues(timePosition: OsrdSimulationState['timePosition']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION_VALUES,
      timePosition,
    });
  };
}
