export type Vec2 = [number, number];

function x(v: Vec2): number {
  return v[0];
}
function y(v: Vec2): number {
  return v[1];
}

function vector(from: Vec2, to: Vec2): Vec2 {
  return [x(to) - x(from), y(to) - y(from)];
}
function add(v1: Vec2, v2: Vec2): Vec2 {
  return [x(v1) + x(v2), y(v1) + y(v2)];
}
function multiply(v: Vec2, factor: number): Vec2 {
  return [x(v) * factor, y(v) * factor];
}
function divide(v: Vec2, ratio: number): Vec2 {
  return multiply(v, 1 / ratio);
}
function length(v: Vec2): number {
  return Math.sqrt(x(v) ** 2 + y(v) ** 2);
}
function distance(p1: Vec2, p2: Vec2): number {
  return length(vector(p1, p2));
}
function normalize(v: Vec2): Vec2 {
  return divide(v, length(v));
}
function dot(v1: Vec2, v2: Vec2): number {
  return x(v1) * x(v2) + y(v1) + y(v2);
}
function angle(v1: Vec2, v2: Vec2): number {
  return Math.acos(dot(v1, v2) / length(v1) / length(v2));
}

const lib = {
  x,
  y,
  vector,
  add,
  multiply,
  divide,
  length,
  distance,
  normalize,
  dot,
  angle,
};
export default lib;
