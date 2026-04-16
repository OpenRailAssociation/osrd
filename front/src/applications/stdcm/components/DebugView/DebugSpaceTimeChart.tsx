import { useCallback, useMemo, useRef, useState } from 'react';

import {
  type DrawingFunction,
  type OperationalPoint,
  type PathData,
  type SpaceTimeChartContextType,
  DEFAULT_ZOOM_MS_PER_PX,
  PathLayer,
  SpaceTimeChart,
  SpaceTimeChartCanvasContext,
  timeScaleToZoomValue,
  useDraw,
} from '@osrd-project/ui-charts';
import { clamp } from 'lodash';

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

const MIN_ZOOM_MS_PER_PX = 600_000;
const MAX_ZOOM_MS_PER_PX = 625;
const zoomValueToTimeScale = (slider: number) =>
  MIN_ZOOM_MS_PER_PX * Math.pow(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX, slider / 100);

const SPACE_COEFFICIENT = 100; // m/px

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

  const chartData = useMemo(() => {
    if (!simData) return null;

    const zoneMap = new Map(
      simData.zone_locations.map((z) => [
        z.name,
        { spaceStart: z.from / 1000, spaceEnd: z.to / 1000 },
      ])
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

    const operationalPoints: OperationalPoint[] = simData.path_properties.operational_points.map(
      (op) => ({
        id: op.extensions.identifier.name + '-' + op.extensions.sncf.ch,
        label: op.extensions.identifier.name + ' ' + op.extensions.sncf.ch,
        position: op.position / 1000,
      })
    );

    const maxSpace = Math.max(...simData.zone_locations.map((z) => z.to / 1000), 1);

    const trainPath: PathData | null =
      simData.train_positions?.length > 0
        ? {
            id: 'new-train',
            label: 'New train',
            points: simData.train_positions.map((pos, i) => ({
              time: departureMs + simData.train_times[i],
              position: pos / 1000,
            })),
          }
        : null;

    return { departureMs, otherBlocks, operationalPoints, maxSpace, trainPath };
  }, [simData]);

  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [timeScale, setTimeScale] = useState(DEFAULT_ZOOM_MS_PER_PX);
  const [spaceCoefficient, setSpaceCoefficient] = useState(SPACE_COEFFICIENT);
  const panRef = useRef<{ initialXOffset: number; initialYOffset: number } | null>(null);

  const handlePan = useCallback<NonNullable<Parameters<typeof SpaceTimeChart>[0]['onPan']>>(
    ({ isPanning, initialPosition, position }) => {
      if (!isPanning) {
        panRef.current = null;
        return;
      }
      if (!panRef.current) {
        panRef.current = { initialXOffset: xOffset, initialYOffset: yOffset };
        return;
      }
      setXOffset(panRef.current.initialXOffset + (position.x - initialPosition.x));
      setYOffset(panRef.current.initialYOffset + (position.y - initialPosition.y));
    },
    [xOffset, yOffset]
  );

  const handleZoom = useCallback<NonNullable<Parameters<typeof SpaceTimeChart>[0]['onZoom']>>(
    ({ delta, position, event }) => {
      if (event.shiftKey) {
        // Shift+scroll: horizontal (time) zoom
        setTimeScale((prev) => {
          const next = clamp(prev / (1 + delta * 0.1), MAX_ZOOM_MS_PER_PX, MIN_ZOOM_MS_PER_PX);
          setXOffset((off) => position.x - ((position.x - off) * prev) / next);
          return next;
        });
      } else {
        // Plain scroll: vertical (space) zoom
        setSpaceCoefficient((prev) => {
          const next = clamp(prev / (1 + delta * 0.1), 10, 5000);
          setYOffset((off) => position.y - (position.y - off) * (prev / next));
          return next;
        });
      }
    },
    []
  );

  const [hoveredBlock, setHoveredBlock] = useState<DebugBlock | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback<
    NonNullable<Parameters<typeof SpaceTimeChart>[0]['onMouseMove']>
  >(
    ({ data: dataPoint }) => {
      if (!chartData) return;
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

  if (!chartData) return <div>No simulation data available</div>;

  const xZoom = timeScaleToZoomValue(timeScale);

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
        <span>Time zoom (Shift+scroll):</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={xZoom}
          style={{ width: 140 }}
          onChange={(e) => setTimeScale(zoomValueToTimeScale(Number(e.target.value)))}
        />
        <button
          type="button"
          onClick={() => {
            setTimeScale(DEFAULT_ZOOM_MS_PER_PX);
            setXOffset(0);
            setYOffset(0);
            setSpaceCoefficient(SPACE_COEFFICIENT);
          }}
        >
          Reset
        </button>
        <span style={{ color: '#888', marginLeft: 8 }}>
          Scroll: space zoom · Drag: pan · Shift+scroll: time zoom
        </span>
      </div>

      <div
        style={{ position: 'relative', width: '100%', height: '80vh' }}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => {
          setMousePos(null);
          setHoveredBlock(null);
        }}
      >
        <SpaceTimeChart
          className="w-full h-full"
          spaceOrigin={0}
          spaceScales={[{ to: chartData.maxSpace, coefficient: spaceCoefficient }]}
          timeOrigin={chartData.departureMs}
          timeScale={timeScale}
          xOffset={xOffset}
          yOffset={yOffset}
          operationalPoints={chartData.operationalPoints}
          onPan={handlePan}
          onZoom={handleZoom}
          onMouseMove={handleMouseMove}
        >
          <DebugOtherTrainsLayer blocks={chartData.otherBlocks} />
          {chartData.trainPath && <PathLayer path={chartData.trainPath} color="#0000ff" />}
        </SpaceTimeChart>
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
