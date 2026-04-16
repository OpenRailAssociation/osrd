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
};

type DebugBlock = {
  timeStart: number;
  timeEnd: number;
  spaceStart: number;
  spaceEnd: number;
  zoneName: string;
  trainName: string;
};

const CHART_HEIGHT = 600;

function DebugOtherTrainsLayer({ blocks }: { blocks: DebugBlock[] }) {
  const draw = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, getSpacePixel }) => {
      ctx.fillStyle = 'rgba(240, 128, 128, 0.5)';
      ctx.strokeStyle = 'rgba(200, 60, 60, 0.9)';
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
    [blocks]
  );
  useDraw(SpaceTimeChartCanvasContext, 'background', draw);
  return null;
}

type DebugSpaceTimeChartProps = { simulationData: unknown };

const DebugSpaceTimeChart = ({ simulationData }: DebugSpaceTimeChartProps) => {
  const simData = simulationData as SimulationData;

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    // All positions kept in mm (raw from the API)
    const zoneMap = new Map(
      simData.zone_locations.map((z) => [z.name, { spaceStart: z.from, spaceEnd: z.to }])
    );
    const departureMs = Date.parse(simData.departure_time);

    const otherBlocks = simData.other_requirements.flatMap((req) => {
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
        },
      ];
    });

    const manchetteWaypoints = simData.path_properties.operational_points.map((op) => ({
      id: op.extensions.identifier.name + '-' + op.extensions.sncf.ch,
      position: op.position, // mm
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
              position: pos, // mm
            })),
          }
        : null;

    return { departureMs, otherBlocks, manchetteWaypoints, trainPath };
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
      const hit = chartData.otherBlocks.find(
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
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: '#f5f5f5',
          borderBottom: '1px solid #ddd',
          fontSize: 13,
        }}
      >
        <span>Time zoom:</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={xZoom}
          style={{ width: 140 }}
          onChange={(e) => handleXZoom(Number(e.target.value))}
        />
        <button type="button" onClick={() => manchetteProps.resetZoom()}>
          Reset
        </button>
        <span style={{ color: '#888', marginLeft: 8 }}>
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
          style={{ height: CHART_HEIGHT }}
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
              <DebugOtherTrainsLayer blocks={chartData.otherBlocks} />
              {chartData.trainPath && <PathLayer path={chartData.trainPath} color="#0000ff" />}
            </SpaceTimeChart>
          </div>
        </div>
      </div>

      {hoveredBlock && mousePos && (
        <div
          style={{
            position: 'fixed',
            left: mousePos.x + 12,
            top: mousePos.y + 12,
            background: 'white',
            border: '1px solid #ccc',
            padding: '4px 8px',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: 400,
          }}
        >
          <div>
            <strong>{hoveredBlock.trainName}</strong>
          </div>
          <div style={{ fontSize: 11, wordBreak: 'break-all' }}>{hoveredBlock.zoneName}</div>
        </div>
      )}
    </div>
  );
};

export default DebugSpaceTimeChart;
