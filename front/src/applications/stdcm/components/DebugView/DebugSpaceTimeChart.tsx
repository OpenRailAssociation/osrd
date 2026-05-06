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
  type Waypoint,
} from '@osrd-project/ui-charts';

import type { SimDebugData } from 'common/api/osrdEditoastApi';

type DebugBlock = {
  timeStart: number;
  timeEnd: number;
  spaceStart: number;
  spaceEnd: number;
  zoneName: string;
  sourceName: string;
  kind: 'other' | 'work_schedule' | 'zone_update' | 'spacing_req';
};

type BlockLayerStyle = { fill: string; stroke: string };

const CHART_HEIGHT = 600;

const KIND_LABEL: Record<DebugBlock['kind'], string> = {
  other: 'Other train',
  work_schedule: 'Work schedule',
  zone_update: 'Zone update',
  spacing_req: 'Spacing requirement',
};

function DebugBlocksLayer({ blocks, style }: { blocks: DebugBlock[]; style: BlockLayerStyle }) {
  const draw = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, getSpacePixel }) => {
      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1;
      for (const block of blocks) {
        const timePixel = getTimePixel(block.timeStart);
        const spacePixel = getSpacePixel(block.spaceStart);
        const rectWidth = getTimePixel(block.timeEnd) - timePixel;
        const rectHeight = getSpacePixel(block.spaceEnd) - spacePixel;
        ctx.fillRect(timePixel, spacePixel, rectWidth, rectHeight);
        ctx.strokeRect(timePixel, spacePixel, rectWidth, rectHeight);
      }
    },
    [blocks, style]
  );
  useDraw(SpaceTimeChartCanvasContext, 'background', draw);
  return null;
}

const LAYER_STYLES: Record<DebugBlock['kind'], BlockLayerStyle> = {
  other: { fill: 'rgba(240, 128, 128, 0.5)', stroke: 'rgba(200, 60, 60, 0.9)' },
  work_schedule: { fill: 'rgba(0, 0, 139, 0.3)', stroke: 'rgba(0, 0, 139, 0.9)' },
  zone_update: { fill: 'rgba(135, 206, 250, 0.5)', stroke: 'rgba(65, 105, 225, 0.9)' },
  spacing_req: { fill: 'rgba(244, 164, 96, 0.5)', stroke: 'rgba(210, 105, 30, 0.9)' },
};

type DebugSpaceTimeChartProps = { simData: SimDebugData };

const DebugSpaceTimeChart = ({ simData }: DebugSpaceTimeChartProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    const zoneMap = new Map(
      simData.zone_locations.map((zone) => [
        zone.name,
        { spaceStart: zone.from, spaceEnd: zone.to },
      ])
    );
    const departureMs = Date.parse(simData.departure_time);

    const otherBlocks: DebugBlock[] = [];
    const workScheduleBlocks: DebugBlock[] = [];
    for (const req of simData.other_requirements) {
      const pos = zoneMap.get(req.zone_name);
      if (!pos) continue;
      const isWorkSchedule = req.source?.type === 'WORK_SCHEDULE';
      (isWorkSchedule ? workScheduleBlocks : otherBlocks).push({
        timeStart: departureMs + req.begin_time,
        timeEnd: departureMs + req.end_time,
        spaceStart: pos.spaceStart,
        spaceEnd: pos.spaceEnd,
        zoneName: req.zone_name,
        sourceName: req.source?.id ?? '(unknown)',
        kind: isWorkSchedule ? 'work_schedule' : 'other',
      });
    }

    const finalOutput = simData.sim_output?.final_output;

    const zoneUpdateBlocks: DebugBlock[] = [];
    if (finalOutput) {
      const entries: Record<string, number> = {};
      const exits: Record<string, number> = {};
      for (const zoneUpdate of finalOutput.zone_updates) {
        if (zoneUpdate.is_entry) entries[zoneUpdate.zone] = zoneUpdate.time;
        else exits[zoneUpdate.zone] = zoneUpdate.time;
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
          sourceName: '',
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
          sourceName: '',
          kind: 'spacing_req',
        });
      }
    }

    const manchetteWaypoints: Waypoint[] = simData.path_properties.operational_points.map((op) => ({
      id: `${op.id}-${op.position}`,
      position: op.position,
      name: op.name,
      secondaryCode: op.secondary_code ?? '',
      weight: op.weight ?? 0,
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

    const allBlocks = [
      ...otherBlocks,
      ...workScheduleBlocks,
      ...zoneUpdateBlocks,
      ...spacingReqBlocks,
    ];

    return {
      departureMs,
      otherBlocks,
      workScheduleBlocks,
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
  const [mousePos, setMousePos] = useState<{ clientX: number; clientY: number } | null>(null);

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
          onChange={(event) => handleXZoom(Number(event.target.value))}
        />
        <button type="button" onClick={() => manchetteProps.resetZoom()}>
          Reset
        </button>
        <span className="debug-space-time-chart__hint">
          Shift+scroll: time zoom · Ctrl+scroll: space zoom · Drag: pan
        </span>
      </div>

      <div
        className="ui-manchette-space-time-chart-wrapper"
        onMouseMove={(event) => setMousePos({ clientX: event.clientX, clientY: event.clientY })}
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
              onMouseMove={({ data: dataPoint }) => {
                const hit = chartData.allBlocks.find(
                  (block) =>
                    dataPoint.time >= block.timeStart &&
                    dataPoint.time <= block.timeEnd &&
                    dataPoint.position >= block.spaceStart &&
                    dataPoint.position <= block.spaceEnd
                );
                setHoveredBlock(hit ?? null);
              }}
            >
              <DebugBlocksLayer blocks={chartData.otherBlocks} style={LAYER_STYLES.other} />
              <DebugBlocksLayer
                blocks={chartData.workScheduleBlocks}
                style={LAYER_STYLES.work_schedule}
              />
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
          style={{ left: mousePos.clientX + 12, top: mousePos.clientY + 12 }}
        >
          <div>
            <strong>{KIND_LABEL[hoveredBlock.kind]}</strong>
            {hoveredBlock.sourceName && <span> — {hoveredBlock.sourceName}</span>}
          </div>
          <div className="debug-space-time-chart__tooltip-zone">{hoveredBlock.zoneName}</div>
        </div>
      )}
    </div>
  );
};

export default DebugSpaceTimeChart;
