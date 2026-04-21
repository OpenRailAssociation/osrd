import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type DrawingFunction,
  type PathData,
  type SpaceTimeChartContextType,
  Manchette,
  PathLayer,
  SpaceTimeChart,
  SpaceTimeChartCanvasContext,
  useDraw,
  useManchetteWithSpaceTimeChart,
} from '@osrd-project/ui-charts';

type ZoneLocation = { name: string; from: number; to: number };
type OtherRequirement = {
  zone_name: string;
  begin_time: number;
  end_time: number;
  train_name?: string;
};
type ZoneUpdate = { zone: string; is_entry: boolean; time: number };
type SpacingRequirement = { zone: string; begin_time: number; end_time: number };
type OperationalPointRaw = {
  position: number;
  extensions: { identifier: { name: string }; sncf: { ch: string } };
};

type SimulationData = {
  departure_time: string;
  train_positions: number[];
  train_times: number[];
  zone_locations: ZoneLocation[];
  other_requirements: OtherRequirement[];
  path_properties: { operational_points: OperationalPointRaw[] };
  sim_output?: {
    final_output: {
      zone_updates: ZoneUpdate[];
      spacing_requirements: SpacingRequirement[];
    };
  };
};

type DebugBlock = {
  timeStart: number;
  timeEnd: number;
  spaceStart: number;
  spaceEnd: number;
  zoneName: string;
  trainName: string;
  kind: 'other' | 'zone_update' | 'spacing_req';
};

type BlockLayerStyle = { fill: string; stroke: string };

const CHART_HEIGHT = 600;

const KIND_LABEL: Record<DebugBlock['kind'], string> = {
  other: 'Other train',
  zone_update: 'Zone update',
  spacing_req: 'Spacing requirement',
};

function DebugBlocksLayer({ blocks, style }: { blocks: DebugBlock[]; style: BlockLayerStyle }) {
  const draw = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, getSpacePixel }) => {
      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1;
      for (const b of blocks) {
        const x = getTimePixel(b.timeStart);
        const y = getSpacePixel(b.spaceStart);
        const w = getTimePixel(b.timeEnd) - x;
        const h = getSpacePixel(b.spaceEnd) - y;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
    },
    [blocks, style]
  );
  useDraw(SpaceTimeChartCanvasContext, 'background', draw);
  return null;
}

const LAYER_STYLES: Record<DebugBlock['kind'], BlockLayerStyle> = {
  other: { fill: 'rgba(240, 128, 128, 0.5)', stroke: 'rgba(200, 60, 60, 0.9)' },
  zone_update: { fill: 'rgba(135, 206, 250, 0.5)', stroke: 'rgba(65, 105, 225, 0.9)' },
  spacing_req: { fill: 'rgba(244, 164, 96, 0.5)', stroke: 'rgba(210, 105, 30, 0.9)' },
};

type DebugSpaceTimeChartProps = { simulationData: unknown };

const DebugSpaceTimeChart = ({ simulationData }: DebugSpaceTimeChartProps) => {
  const simData = simulationData as SimulationData;

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    const zoneMap = new Map(
      simData.zone_locations.map((z) => [z.name, { spaceStart: z.from, spaceEnd: z.to }])
    );
    const departureMs = Date.parse(simData.departure_time);

    const otherBlocks: DebugBlock[] = simData.other_requirements.flatMap((req) => {
      const pos = zoneMap.get(req.zone_name);
      if (!pos) return [];
      return [
        {
          timeStart: departureMs + req.begin_time,
          timeEnd: departureMs + req.end_time,
          spaceStart: pos.spaceStart,
          spaceEnd: pos.spaceEnd,
          zoneName: req.zone_name,
          trainName: req.train_name ?? '',
          kind: 'other',
        },
      ];
    });

    const finalOutput = simData.sim_output?.final_output;

    const zoneUpdateBlocks: DebugBlock[] = [];
    if (finalOutput) {
      const entries: Record<string, number> = {};
      const exits: Record<string, number> = {};
      for (const u of finalOutput.zone_updates) {
        if (u.is_entry) entries[u.zone] = u.time;
        else exits[u.zone] = u.time;
      }
      for (const zone of Object.keys(entries)) {
        if (!(zone in exits)) continue;
        const pos = zoneMap.get(zone);
        if (!pos) continue;
        zoneUpdateBlocks.push({
          timeStart: departureMs + entries[zone],
          timeEnd: departureMs + exits[zone],
          spaceStart: pos.spaceStart,
          spaceEnd: pos.spaceEnd,
          zoneName: zone,
          trainName: '',
          kind: 'zone_update',
        });
      }
    }

    const spacingReqBlocks: DebugBlock[] = [];
    if (finalOutput) {
      for (const req of finalOutput.spacing_requirements) {
        const pos = zoneMap.get(req.zone);
        if (!pos) continue;
        spacingReqBlocks.push({
          timeStart: departureMs + req.begin_time,
          timeEnd: departureMs + req.end_time,
          spaceStart: pos.spaceStart,
          spaceEnd: pos.spaceEnd,
          zoneName: req.zone,
          trainName: '',
          kind: 'spacing_req',
        });
      }
    }

    const manchetteWaypoints = simData.path_properties.operational_points.map((op) => ({
      id: op.extensions.identifier.name + '-' + op.extensions.sncf.ch,
      position: op.position,
      name: op.extensions.identifier.name,
      secondaryCode: op.extensions.sncf.ch,
    }));

    const trainPath: PathData | null =
      simData.train_positions?.length > 0
        ? {
            id: 'new-train',
            label: 'New train',
            points: simData.train_positions.map((pos, i) => ({
              time: departureMs + simData.train_times[i],
              position: pos,
            })),
          }
        : null;

    const allBlocks = [...otherBlocks, ...zoneUpdateBlocks, ...spacingReqBlocks];

    return {
      departureMs,
      otherBlocks,
      zoneUpdateBlocks,
      spacingReqBlocks,
      allBlocks,
      manchetteWaypoints,
      trainPath,
    };
  }, [simData]);

  const { manchetteProps, spaceTimeChartProps, handleScroll, handleXZoom, xZoom, setTimeOrigin } =
    useManchetteWithSpaceTimeChart({
      waypoints: chartData.manchetteWaypoints ?? [],
      manchetteWithSpaceTimeChartRef,
      height: CHART_HEIGHT,
      spaceTimeChartRef,
    });

  useEffect(() => {
    setTimeOrigin(chartData.departureMs);
  }, [chartData]);

  const [hoveredBlock, setHoveredBlock] = useState<DebugBlock | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback<
    NonNullable<Parameters<typeof SpaceTimeChart>[0]['onMouseMove']>
  >(
    ({ data: dataPoint }) => {
      const hit = chartData.allBlocks.find(
        (b) =>
          dataPoint.time >= b.timeStart &&
          dataPoint.time <= b.timeEnd &&
          dataPoint.position >= b.spaceStart &&
          dataPoint.position <= b.spaceEnd
      );
      setHoveredBlock(hit ?? null);
    },
    [chartData]
  );

  return (
    <div className="debug-space-time-chart">
      <div className="debug-space-time-chart__controls">
        <span>Time zoom:</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={xZoom}
          className="debug-space-time-chart__zoom-slider"
          onChange={(e) => handleXZoom(Number(e.target.value))}
        />
        <button type="button" onClick={() => manchetteProps.resetZoom()}>
          Reset
        </button>
        <span className="debug-space-time-chart__hint">
          Scroll: space zoom · Drag: pan · Ctrl+scroll: Y zoom
        </span>
      </div>

      <div
        className="ui-manchette-space-time-chart-wrapper"
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => {
          setMousePos(null);
          setHoveredBlock(null);
        }}
      >
        <div
          ref={manchetteWithSpaceTimeChartRef}
          className="manchette flex"
          onScroll={handleScroll}
        >
          <Manchette {...manchetteProps} />
          <div ref={spaceTimeChartRef} className="space-time-chart-container w-full sticky">
            <SpaceTimeChart
              className="inset-0 absolute h-full"
              height={CHART_HEIGHT}
              {...spaceTimeChartProps}
              onZoom={(payload) => {
                if (payload.event.ctrlKey) {
                  payload.event.preventDefault();
                  if (payload.delta > 0) manchetteProps.zoomYIn();
                  else manchetteProps.zoomYOut();
                } else {
                  spaceTimeChartProps.onZoom?.(payload);
                }
              }}
              onMouseMove={handleMouseMove}
            >
              <DebugBlocksLayer blocks={chartData.otherBlocks} style={LAYER_STYLES.other} />
              <DebugBlocksLayer
                blocks={chartData.zoneUpdateBlocks}
                style={LAYER_STYLES.zone_update}
              />
              <DebugBlocksLayer
                blocks={chartData.spacingReqBlocks}
                style={LAYER_STYLES.spacing_req}
              />
              {chartData.trainPath && <PathLayer path={chartData.trainPath} color="#0000ff" />}
            </SpaceTimeChart>
          </div>
        </div>
      </div>

      {hoveredBlock && mousePos && (
        <div
          className="debug-space-time-chart__tooltip"
          style={{ left: mousePos.x + 12, top: mousePos.y + 12 }}
        >
          <div>
            <strong>{KIND_LABEL[hoveredBlock.kind]}</strong>
            {hoveredBlock.trainName && <span> — {hoveredBlock.trainName}</span>}
          </div>
          <div className="debug-space-time-chart__tooltip-zone">{hoveredBlock.zoneName}</div>
        </div>
      )}
    </div>
  );
};

export default DebugSpaceTimeChart;
