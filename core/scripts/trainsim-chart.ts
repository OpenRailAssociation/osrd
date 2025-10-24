// See the trainsim-chart.html for info.

type Point = { x: number, y: number };
type Box = { x1: number, y1: number, x2: number, y2: number };
type Curve = { xs: number[]; ys: number[]; };

function mm2m(mm: bigint): number {
  return Number(mm / 1000n) + Number(mm % 1000n) / 1000;
}

function µm2m(µm: bigint): number {
  return Number(µm / 1000000n) + Number(µm % 1000000n) / 1000000;
}

class TrainState {
  time: number;
  position: number;
  speed: number;
  pantographPosition: number;
  pantographGoingUp: boolean;

  static encodedSizeBytes = 32;

  constructor(time: number, position: number, speed: number, pantographPosition: number, pantographGoingUp: boolean) {
    this.time = time;
    this.position = position;
    this.speed = speed;
    this.pantographPosition = pantographPosition;
    this.pantographGoingUp = pantographGoingUp;
  }

  static fromDataView(view: DataView<ArrayBuffer>, offset: number): TrainState {
    const time = µm2m(view.getBigUint64(offset, true));
    const position = µm2m(view.getBigUint64(offset + 8, true));
    const speed = µm2m(view.getBigUint64(offset + 16, true));
    const pantograph = view.getFloat64(offset + 24, true);
    const pantographPosition = Math.abs(pantograph);
    const pantographGoingUp = 1 / pantograph < 0;
    return new TrainState(time, position, speed, pantographPosition, pantographGoingUp);
  }
}

class Run {
  label: string;
  xs: number[];
  ys: number[];
  decisions: [string, TrainState][][];

  constructor() {
    this.label = '';
    this.xs = [];
    this.ys = [];
    this.decisions = [];
  }

  get length(): number {
    return this.xs.length;
  }

  minX(): number {
    return this.xs[0] ?? Number.POSITIVE_INFINITY;
  }

  maxX(): number {
    const lastDecisions = this.decisions.at(-1);
    let max = this.xs.at(-1) ?? Number.NEGATIVE_INFINITY;

    if (lastDecisions) {
      for (const [_, decision] of lastDecisions) {
        if (decision.position > max) max = decision.position;
      }
    }

    return max;
  }

  maxY(): number {
    let max = this.ys.at(0) ?? Number.NEGATIVE_INFINITY;

    for (const y of this.ys) {
      if (y > max) max = y;
    }

    for (const stepDecisions of this.decisions) {
      for (const [_, decision] of stepDecisions) {
        if (decision.speed > max) max = decision.speed;
      }
    }

    return max;
  }

  pushPoint(x: number, y: number) {
    this.xs.push(x);
    this.ys.push(y);
  }

  pushDecision(constraintName: string, decision: TrainState) {
    const stepDecisions = this.decisions.at(-1);

    if (!stepDecisions) {
      // Malformed input file that didn't call stepStart before adding decisions, ignore.
      return;
    }

    stepDecisions.push([constraintName, decision]);
  }
}

function parseGradients(view: DataView<ArrayBuffer>, offset: number): Curve {
  const nValues = view.getUint32(offset, true);

  offset += 4;

  const xs = Array(nValues + 1);
  const ys = Array(nValues + 1);

  xs[0] = 0;
  ys[0] = 0;

  let x = 0;
  let y = 0;

  for (let i = 0; i < nValues; i++) {
    const bound = µm2m(view.getBigUint64(offset + 8 * i, true));
    const gradient = view.getFloat64(offset + 8 * (nValues + i), true) / 1000;

    y += gradient * (bound - x);
    x = bound;

    xs[i + 1] = x;
    ys[i + 1] = y;
  }

  return { xs, ys };
}

function parseSpeedCurve(view: DataView<ArrayBuffer>, offset: number): Curve {
  const nValues = view.getUint32(offset, true);

  offset += 4;

  const xs = Array(nValues);
  const ys = Array(nValues);

  for (let i = 0; i < nValues; i++) {
    const x = µm2m(view.getBigUint64(offset + 8 * i, true));
    const y = µm2m(view.getBigUint64(offset + 8 * (nValues + i), true));

    xs[i] = x;
    ys[i] = y;
  }

  return { xs, ys };
}

function parseTrace(view: DataView<ArrayBuffer>): [Run[], Curve, Curve[]] {
  const runs: Run[] = [];
  let pendingRun = new Run();

  const gradients: Curve = { xs: [], ys: [] };

  const speedCurves: Curve[] = [];

  try {
    const constraints: string[] = [];

    let offset = 0;

    while (offset < view.byteLength) {
      const traceType = view.getUint32(offset, true);
      const traceLen = view.getUint32(offset + 4, true);

      offset += 8;

      switch (traceType) {
        case 0: // Constraint
          const buffer = view.buffer.slice(offset, offset + traceLen);
          const name = new TextDecoder().decode(buffer);
          constraints.push(`${name} (#${constraints.length})`);

          break;
        case 1: // Decisions
          const constraintIndex = view.getUint32(offset, true);
          const constraintName = constraints.at(constraintIndex) ?? `constraint #${constraintIndex}`;

          for (let i = offset + 4; i < offset + traceLen; i += TrainState.encodedSizeBytes) {
            let trainState = TrainState.fromDataView(view, i);
            pendingRun.pushDecision(constraintName, trainState);
          }

          break;
        case 2: { // Merged state
          const trainState = TrainState.fromDataView(view, offset);
          pendingRun.pushDecision('merge', trainState);

          break;
        }
        case 3: // Truncated state
          const trainState = TrainState.fromDataView(view, offset);
          pendingRun.pushPoint(trainState.position, trainState.speed);

          break;
        case 4: // Step start
          if (pendingRun.length === 0) {
            const trainState = TrainState.fromDataView(view, offset);
            pendingRun.pushPoint(trainState.position, trainState.speed);
          }
          pendingRun.decisions.push([]);

          break;
        case 5: // Gradients
          const g = parseGradients(view, offset);

          gradients.xs = g.xs;
          gradients.ys = g.ys;

          break;
        case 6: // Run start
          if (pendingRun.length > 0) {
            runs.push(pendingRun);
            pendingRun = new Run();
          }

          const buffer2 = view.buffer.slice(offset, offset + traceLen);
          pendingRun.label = new TextDecoder().decode(buffer2);

          break;
        case 7: // Speed curve
          speedCurves.push(parseSpeedCurve(view, offset + 4));

          break;
        default:
          console.log(`unknown trace type ${traceType} of length ${traceLen}`);
      }

      offset += traceLen;
    }
  } catch (e) {
    if (!(e instanceof RangeError)) {
      throw e;
    }
    // expect RangeError to mean that we read past the end of the buffer.
    // in such cases, return what we have instead of throwing
  }

  if (pendingRun.xs.length > 0) {
    runs.push(pendingRun);
  }

  return [runs, gradients, speedCurves];
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

function makeXTransform(canvasMin: number, canvasMax: number, valueMin: number, valueMax: number): (v: number) => number {
  const scale = (canvasMax - canvasMin) / (valueMax - valueMin);
  const offset = canvasMin + (canvasMin - canvasMax) * valueMin / (valueMax - valueMin);
  return (v: number) => scale * v + offset;
}

function makeYTransform(canvasMin: number, canvasMax: number, valueMin: number, valueMax: number): (v: number) => number {
  const scale = (canvasMin - canvasMax) / (valueMax - valueMin);
  const offset = canvasMax + (canvasMax - canvasMin) * valueMin / (valueMax - valueMin);
  return (v: number) => scale * v + offset;
}

type CanvasData = {
  runs: Run[],
  maxSpeed: number,
  gradients: Curve,
  minGradient: number,
  maxGradient: number,
  speedCurves: Curve[],
  viewBounds: Box,
  mousePosition: Point,
};

function newCanvasData(): CanvasData {
  return {
    runs: [],
    maxSpeed: 1,
    gradients: { xs: [], ys: [] },
    minGradient: 0,
    maxGradient: 1,
    speedCurves: [],
    viewBounds: { x1: 0, y1: 0, x2: 1, y2: 1 },
    mousePosition: { x: 0, y: 0 },
  };
}

const POINT_RADIUS: number = 2;
const POINT_RADIUS_HOVERED: number = 8;
const xAxisHeight = 20;
const yAxisWidth = 80;

function drawGraph(canvas: HTMLCanvasElement, d: CanvasData) {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  if (d.runs.length === 0 || canvasWidth < yAxisWidth * 2 || canvasHeight < xAxisHeight) {
    return;
  }

  const xTransform = makeXTransform(yAxisWidth, canvasWidth - yAxisWidth, d.viewBounds.x1, d.viewBounds.x2);
  const speedTransform = makeYTransform(POINT_RADIUS, canvasHeight - xAxisHeight, 0, d.maxSpeed);
  const gTransform = makeYTransform(POINT_RADIUS, canvasHeight - xAxisHeight, d.minGradient, d.maxGradient);

  const ctx = canvas.getContext('2d')!!;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (d.gradients.xs.length !== 0) {
    ctx.strokeStyle = 'green';

    // TODO perf: skip first and last points when they are offscreen
    ctx.beginPath();
    ctx.moveTo(xTransform(d.gradients.xs[0]), gTransform(d.gradients.ys[0]));
    for (let i = 1; i < d.gradients.xs.length; i++) {
      ctx.lineTo(xTransform(d.gradients.xs[i]), gTransform(d.gradients.ys[i]));
    }
    ctx.stroke();
  }

  for (const run of d.runs) {
    if (run.length === 0) {
      continue;
    }

    ctx.strokeStyle = 'blue';
    ctx.fillStyle = 'blue';

    // TODO perf: skip first and last points when they are offscreen
    ctx.beginPath();
    ctx.moveTo(xTransform(run.xs[0]), speedTransform(run.ys[0]));
    for (let i = 1; i < run.length; i++) {
      ctx.lineTo(xTransform(run.xs[i]), speedTransform(run.ys[i]));
    }
    ctx.stroke();

    // TODO perf: skip first and last points when they are offscreen
    let lastDrawX = Number.POSITIVE_INFINITY;
    let lastDrawY = Number.POSITIVE_INFINITY;
    for (let i = 0; i < run.length; i++) {
      const x = xTransform(run.xs[i]);
      const y = speedTransform(run.ys[i]);

      if (distance(x, y, lastDrawX, lastDrawY) <= POINT_RADIUS && i < run.length - 1) {
        continue;
      }

      lastDrawX = x;
      lastDrawY = y;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, POINT_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  ctx.strokeStyle = 'red';

  for (const { xs, ys } of d.speedCurves) {
    if (xs.length === 0) {
      continue;
    }

    ctx.beginPath();

    // TODO hover speed curves?
    ctx.moveTo(xTransform(xs[0]), speedTransform(ys[0]));
    for (let i = 1; i < xs.length; i++) {
      ctx.lineTo(xTransform(xs[i]), speedTransform(ys[i]));
    }
    ctx.stroke();
  }

  // TODO draw the axis
}

function getHoveredPoint(canvas: HTMLCanvasElement, d: CanvasData): [number, number] | undefined {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  if (d.runs.length === 0 || canvasWidth < yAxisWidth * 2 || canvasHeight < xAxisHeight) {
    return;
  }

  const xTransform = makeXTransform(yAxisWidth, canvasWidth - yAxisWidth, d.viewBounds.x1, d.viewBounds.x2);
  const speedTransform = makeYTransform(POINT_RADIUS, canvasHeight - xAxisHeight, 0, d.maxSpeed);

  let hoveredRunIndex = -1;
  let hoveredPoint = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < d.runs.length; i++) {
    const run = d.runs[i];

    let closestPoint = 0;
    let closestDistanceRun = distance(xTransform(run.xs[0]), speedTransform(run.ys[0]), d.mousePosition.x, d.mousePosition.y);

    for (let ir = 1; ir < run.length; ir++) {
      const id = distance(xTransform(run.xs[ir]), speedTransform(run.ys[ir]), d.mousePosition.x, d.mousePosition.y);
      if (id < closestDistanceRun) {
        closestPoint = ir;
        closestDistanceRun = id;
      }
    }

    if (closestDistanceRun > POINT_RADIUS_HOVERED || closestDistance < closestDistanceRun) {
      continue;
    }

    hoveredRunIndex = i;
    hoveredPoint = closestPoint;
    closestDistance = closestDistanceRun;
  }

  if (hoveredRunIndex < 0) {
    return;
  }

  return [hoveredRunIndex, hoveredPoint];
}

function drawHover(canvas: HTMLCanvasElement, d: CanvasData) {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const ctx = canvas.getContext('2d')!!;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const hp = getHoveredPoint(canvas, d);
  if (!hp) {
    return;
  }
  const [hoveredRunIndex, hoveredPoint] = hp;

  const xTransform = makeXTransform(yAxisWidth, canvasWidth - yAxisWidth, d.viewBounds.x1, d.viewBounds.x2);
  const speedTransform = makeYTransform(POINT_RADIUS, canvasHeight - xAxisHeight, 0, d.maxSpeed);

  const run = d.runs[hoveredRunIndex];

  const x = xTransform(run.xs[hoveredPoint]);
  const y = speedTransform(run.ys[hoveredPoint]);

  ctx.fillStyle = 'blue';

  ctx.beginPath();
  ctx.arc(x, y, POINT_RADIUS_HOVERED, 0, 2 * Math.PI);
  ctx.fill();

  if (!run.decisions[hoveredPoint]) {
    return;
  }

  ctx.strokeStyle = 'orange';
  ctx.fillStyle = 'orange';
  ctx.font = '10px sans-serif';
  ctx.textBaseline = 'top';

  let popupX = POINT_RADIUS_HOVERED * 2 + xTransform(Math.max(...run.decisions[hoveredPoint].map(([_, decision]) => decision.position)));
  let popupY = -POINT_RADIUS_HOVERED + speedTransform(Math.max(...run.decisions[hoveredPoint].map(([_, decision]) => decision.speed)));

  for (const [_name, decision] of run.decisions[hoveredPoint]) {
    const decisionX = xTransform(decision.position);
    const decisionY = speedTransform(decision.speed);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(decisionX, decisionY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(decisionX, decisionY);
    ctx.arc(decisionX, decisionY, POINT_RADIUS_HOVERED, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.strokeStyle = '#000000ab';

  for (const [name, decision] of run.decisions[hoveredPoint]) {
    const decisionX = xTransform(decision.position);
    const decisionY = speedTransform(decision.speed);
    const metrics = ctx.measureText(name);

    ctx.fillStyle = '#000000ab';
    ctx.fillRect(popupX, popupY, 4 + metrics.width, 4 + metrics.fontBoundingBoxDescent);
    ctx.beginPath();
    ctx.moveTo(popupX, popupY + 2 + metrics.fontBoundingBoxDescent / 2);
    ctx.lineTo(decisionX, decisionY);
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.fillText(name, popupX + 2, popupY + 2);

    popupY += 6 + metrics.fontBoundingBoxDescent;
  }
}

function setStatus(span: HTMLSpanElement, canvas: HTMLCanvasElement, d: CanvasData) {
  const hp = getHoveredPoint(canvas, d);
  if (!hp) {
    span.innerText = '';
    return;
  }
  const [hoveredRunIndex, hoveredPoint] = hp;

  const run = d.runs[hoveredRunIndex];
  const position = d.runs[hoveredRunIndex].xs[hoveredPoint];
  const speed = d.runs[hoveredRunIndex].ys[hoveredPoint];
  const nDecisions = d.runs[hoveredRunIndex].decisions[hoveredPoint].length;

  span.innerText = `Run "${run.label}", point no. ${hoveredPoint}, pos=${position}m, speed=${speed}m/s, ${nDecisions} constraints apply`;
}

const form = document.getElementById('form') as HTMLFormElement;
const statusSpan = document.getElementById('status') as HTMLSpanElement;
const graphCanvas = document.getElementById('graph') as HTMLCanvasElement;
const hoverCanvas = document.getElementById('hover') as HTMLCanvasElement;

let data = newCanvasData();

form.addEventListener('submit', (event) => {
  async function openTrace(file: File) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    const [r, g, sc] = parseTrace(view);
    data.runs = r;
    data.maxSpeed = Math.max(...r.map(run => run.maxY())) + POINT_RADIUS;
    data.gradients = g;
    data.minGradient = Math.min(...g.ys);
    data.maxGradient = Math.max(...g.ys);
    data.speedCurves = sc;
    data.viewBounds.x1 = Math.min(g.xs.length === 0 ? 0 : g.xs[0], ...r.map(run => run.minX()));
    data.viewBounds.x2 = Math.min(g.xs.length === 0 ? 0 : g.xs[g.xs.length - 1], ...r.map(run => run.maxX()));

    drawGraph(graphCanvas, data);
  }

  event.preventDefault();
  data = newCanvasData(); // avoid out of memory errors
  openTrace(form.file.files[0]);
});

hoverCanvas.addEventListener('mousemove', (event) => {
  const canvasRect = graphCanvas.getBoundingClientRect();
  const x = event.x - canvasRect.x;
  const y = event.y - canvasRect.y;

  if (event.buttons === 1) {
    const scaleX = (data.viewBounds.x2 - data.viewBounds.x1) / graphCanvas.width;
    const deltaX = (x - data.mousePosition.x) * scaleX;

    data.viewBounds.x1 -= deltaX;
    data.viewBounds.x2 -= deltaX;

    // TODO perf: use ctx.drawImage with ctx.globalCompositeOperation=="copy" to avoid drawing most of the canvas
  }

  data.mousePosition.x = x;
  data.mousePosition.y = y;

  if (event.buttons === 1) {
    drawGraph(graphCanvas, data);
  }

  drawHover(hoverCanvas, data);
  setStatus(statusSpan, hoverCanvas, data);
});

// TODO perf: squash wheel events while drawing in case drawing takes more than 1 frame
hoverCanvas.addEventListener('wheel', (event) => {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || !event.shiftKey) {
    return;
  }

  const deltaY = Math.min(Math.max(event.deltaY, -100), 100);
  const oldViewWidth = data.viewBounds.x2 - data.viewBounds.x1;
  const deltaBound = -oldViewWidth * deltaY / 1000;
  const bias = data.mousePosition.x / graphCanvas.width;

  data.viewBounds.x1 += bias * deltaBound;
  data.viewBounds.x2 -= (1 - bias) * deltaBound;
  drawGraph(graphCanvas, data);
  drawHover(hoverCanvas, data);
}, { passive: true });
