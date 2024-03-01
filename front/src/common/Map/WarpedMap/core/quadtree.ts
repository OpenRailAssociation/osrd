/* eslint-disable prefer-destructuring, no-plusplus */
import bbox from '@turf/bbox';
import type { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Position } from 'geojson';

// The following types help describing a full QuadTree:
export type Leaf<T> = {
  type: 'leaf';
  elements: T[];
};
export type Quad<T> = {
  type: 'quad';
  bbox: BBox2d;
  children: [QuadChild<T> | null, QuadChild<T> | null, QuadChild<T> | null, QuadChild<T> | null];
};
export type QuadChild<T> = Quad<T> | Leaf<T>;

export function bboxIntersect([mx1, my1, Mx1, My1]: BBox2d, [mx2, my2, Mx2, My2]: BBox2d): boolean {
  return !(mx1 > Mx2) && !(Mx1 < mx2) && !(my1 > My2) && !(My1 < my2);
}

function getNewQuadChild<T>(box: BBox2d, isLeaf?: boolean): QuadChild<T> {
  return isLeaf
    ? {
        type: 'leaf',
        elements: [],
      }
    : {
        type: 'quad',
        bbox: box,
        children: [null, null, null, null],
      };
}

/**
 * This function takes a collection of GeoJSON features and a depth, and returns a QuadTree of the given depth, with all
 * features properly indexed.
 */
export function getQuadTree<G extends Geometry | null = Geometry, P = GeoJsonProperties>(
  collection: FeatureCollection<G, P>,
  depth: number
): Quad<Feature<G, P>> {
  const boundingBox = bbox(collection) as BBox2d;
  const root = getNewQuadChild(boundingBox) as Quad<Feature<G, P>>;

  for (let i = 0, l = collection.features.length; i < l; i++) {
    const feature = collection.features[i];
    const fBBox = bbox(feature) as BBox2d;

    let quads: QuadChild<Feature<G, P>>[] = [root];
    for (let d = 0; d < depth; d++) {
      if (!quads.length) break;

      const newQuads: QuadChild<Feature<G, P>>[] = [];
      for (let j = 0, quadsCount = quads.length; j < quadsCount; j++) {
        const quad = quads[j];
        if (quad.type !== 'quad') break;

        const [x1, y1, x2, y2] = quad.bbox;
        const ax = (x1 + x2) / 2;
        const ay = (y1 + y2) / 2;

        const candidates: BBox2d[] = [
          [x1, y1, ax, ay],
          [ax, y1, x2, ay],
          [x1, ay, ax, y2],
          [ax, ay, x2, y2],
        ];
        for (let k = 0; k < candidates.length; k++) {
          const candidate = candidates[k];
          if (bboxIntersect(fBBox, candidate)) {
            quad.children[k] = quad.children[k] || getNewQuadChild(candidate, d === depth - 1);
            newQuads.push(quad.children[k] as QuadChild<Feature<G, P>>);
          }
        }
      }

      quads = newQuads;
    }

    for (let j = 0, k = quads.length; j < k; j++) {
      const quad = quads[j];
      if (quad.type !== 'leaf') break;

      quad.elements.push(feature);
    }
  }

  return root;
}

/**
 * This function takes a QuadTree and a point's coordinates, and returns all GeoJSON features indexed in the deepest
 * quad containing the given point.
 */
export function getElements<T>(point: Position, quadTree: Quad<T>): T[] {
  const [x, y] = point;
  const [minX, minY, maxX, maxY] = quadTree.bbox;
  const avgX = (minX + maxX) / 2;
  const avgY = (minY + maxY) / 2;

  let child: QuadChild<T> | null;
  if (x < avgX && y < avgY) child = quadTree.children[0];
  else if (x > avgX && y < avgY) child = quadTree.children[1];
  else if (x < avgX && y > avgY) child = quadTree.children[2];
  else child = quadTree.children[3];

  if (!child) return [];
  if (child.type === 'quad') return getElements(point, child);

  return child.elements;
}
