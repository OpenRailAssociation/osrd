import * as assert from 'assert';
import { tail, last } from 'lodash';
import distance from '@turf/distance';
import length from '@turf/length';
import along from '@turf/along';

import { LinearMetadataItem, update, resizeSegment, splitAt, mergeIn } from './data';

const DEBUG = false;

interface Degree {
  degree: number;
}

const defaultLine = {
  type: 'LineString',
  coordinates: [
    [-1.5416908264160156, 47.21717794690891],
    [-1.5247821807861328, 47.220675713408426],
    [-1.512765884399414, 47.22254109452638],
    [-1.5050411224365234, 47.22568877633443],
    [-1.5014362335205078, 47.229302550889734],
  ],
};

// Follow the LineString (simpliest)
// Line    : ----- ----- ----- -----
// Wrapper : ----- ----- ----- -----
const wrapperThatFollowLine = tail(defaultLine.coordinates).reduce<
  Array<LinearMetadataItem<Degree>>
>((acc, coord, index) => {
  const from = defaultLine.coordinates[index];
  const begin = acc.length > 0 ? acc[index - 1].end : 0;
  const end = begin + distance(from, coord) * 1000;
  acc.push({ begin, end, degree: index });
  return acc;
}, []);

// console.log(wrapper1);
// [
//   { begin: 0, end: 1334.9166539490695, degree: 0 },
//   { begin: 1334.9166539490695, end: 2265.7879100768832, degree: 1 },
//   { begin: 2265.7879100768832, end: 2946.078713959997, degree: 2 },
//   { begin: 2946.078713959997, end: 3431.4330805212953, degree: 3 }
// ]

// Overlaps
// Line    : ----- ----- ----- -----
// Wrapper : ------- ------ --------
const wrapperOverlaps = [
  { begin: 0, end: 1400, degree: 0 },
  { begin: 1400, end: 2500, degree: 1 },
  { begin: 2500, end: 3431.4330805212953, degree: 2 },
];

// Overlaps with one breaking point that is the same
// Line    : ----- ----- ----- -----
// Wrapper : ------- --- -----------
const wrapperOneInCommon = [
  { begin: 0, end: 1400, degree: 0 },
  { begin: 1400, end: 2265.7879100768832, degree: 1 },
  { begin: 2265.7879100768832, end: 3431.4330805212953, degree: 2 },
];

const wrapperTests = [
  { title: 'line', wrapper: wrapperThatFollowLine },
  { title: 'overlaps', wrapper: wrapperOverlaps },
  { title: 'oneInCommon', wrapper: wrapperOneInCommon },
];

/**
 * Check the validity of linear metadata.
 */
function checkWrapperValidity(result, newLine, message) {
  // Checking extrimities
  assert.equal(result[0].begin, 0, message);
  // we round due to some approximation that result to a diff (below millimeter)
  if (newLine)
    assert.equal(Math.round(last(result).end), Math.round(length(newLine) * 1000), message);
  // Checking the continuity
  tail(result).forEach((value, index) => {
    assert.equal(value.begin <= value.end, true, message);
    const prev = result[index];
    assert.equal(value.begin, prev.end, message);
  });
}

/**
 * Generate a GeoJSON of the line plus its linear metadata
 * that can be pasted on https://geojson.io/ to see the result.
 */
function generateGeoJson<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  line: LineString
): FeatureCollection<LineString, T> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: line,
        properties: { stroke: '#ef2929', 'stroke-width': 2, 'stroke-opacity': 1 },
      },
      ...linearMetadata.map((item) => ({
        type: 'Feature',
        properties: {
          ...item,
          distance: Math.round(item.end - item.begin),
          stroke: '#729fcf',
          'stroke-width': 10,
          'stroke-opacity': 0.5,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            along(line, item.begin / 1000).geometry.coordinates,
            along(line, item.end / 1000).geometry.coordinates,
          ],
        },
      })),
    ],
  };
}

describe('Testing linear metadata functions', () => {
  it('Impact on move point should work', () => {
    const newLine = {
      type: 'LineString',
      coordinates: [
        [-1.5416908264160156, 47.21717794690891],
        [-1.53, 47.3],
        [-1.512765884399414, 47.22254109452638],
        [-1.5050411224365234, 47.22568877633443],
        [-1.5014362335205078, 47.229302550889734],
      ],
    };
    wrapperTests.forEach((test) => {
      if (DEBUG)
        console.log('start', JSON.stringify(generateGeoJson(test.wrapper, defaultLine), null, 2));
      const result = update(defaultLine, newLine, test.wrapper);
      if (DEBUG) console.log('result', JSON.stringify(generateGeoJson(result, newLine), null, 2));

      // validity test
      checkWrapperValidity(result, newLine, test.title);
      // same size
      assert.equal(result.length, test.wrapper.length, test.title);

      // Checking that properties are kept
      result.forEach((value, index) => {
        assert.equal(value.degree, index, test.title);
      });
    });
  });

  it('Impact on delete point should work', () => {
    const newLine = {
      type: 'LineString',
      coordinates: [
        [-1.5416908264160156, 47.21717794690891],
        [-1.512765884399414, 47.22254109452638],
        [-1.5050411224365234, 47.22568877633443],
        [-1.5014362335205078, 47.229302550889734],
      ],
    };

    wrapperTests.forEach((test) => {
      if (DEBUG)
        console.log('start', JSON.stringify(generateGeoJson(test.wrapper, defaultLine), null, 2));
      const result = update(defaultLine, newLine, test.wrapper);
      if (DEBUG) console.log('result', JSON.stringify(generateGeoJson(result, newLine), null, 2));

      // validity test
      checkWrapperValidity(result, newLine, test.title);
      // same size
      assert.equal(result.length, test.wrapper.length, test.title);

      // Checking that properties are kept
      result.forEach((value, index) => {
        assert.equal(value.degree, index, test.title);
      });
    });
  });

  describe('resizing a segment', () => {
    it('increase should fail on wrapper of size 1', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [{ begin: 0, end: 10, degree: 0 }];
      try {
        resizeSegment(wrapper, 0, 10);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });

    it('decrease should fail on wrapper of size 1', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [{ begin: 0, end: 10, degree: 0 }];
      try {
        resizeSegment(wrapper, 0, -5);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });

    it('increase on the last item should do nothing', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = resizeSegment(wrapper, 3, 5);
      assert.equal(result.result[3].end, 40);
    });

    it('decrease on the last item should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = resizeSegment(wrapper, 3, -5);
      assert.equal(result.result[3].end, 40);
    });

    it('increase should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = resizeSegment(wrapper, 2, 5);

      // check the decrease of the prev element
      assert.equal(result.result[2].begin, 20);
      assert.equal(result.result[2].end, 35);
      // check the increase of the last element
      assert.equal(result.result[3].begin, 35);
      assert.equal(result.result[3].end, 40);
    });

    it('decrease should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = resizeSegment(wrapper, 2, -5);

      // check the increase of the prev element
      assert.equal(result.result[2].begin, 20);
      assert.equal(result.result[2].end, 25);
      // check the decrease of the last element
      assert.equal(result.result[3].begin, 25);
      assert.equal(result.result[3].end, 40);
    });

    it('decrease more than the element size should fail', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      try {
        resizeSegment(wrapper, 3, -10);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });

    it('increase more than the sibling element size should fail', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      try {
        resizeSegment(wrapper, 1, 10);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });

    it('should throw an error on bad index', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      try {
        resizeSegment(wrapper, 3, -5);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });
  });

  describe('split a segment', () => {
    it('should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = splitAt(wrapper, 25);

      // validity test
      checkWrapperValidity(result);
      // check that the size increased of 1
      assert.equal(result.length, 5);
    });
  });

  describe('merge a segment', () => {
    it('merge on left should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 1 },
        { begin: 20, end: 30, degree: 2 },
        { begin: 30, end: 40, degree: 3 },
      ];
      const result = mergeIn(wrapper, 1, 'left');

      // validity test
      checkWrapperValidity(result);
      // check that the size decreased of 1
      assert.equal(result.length, 3);
    });

    it('merge on right should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 1 },
        { begin: 20, end: 30, degree: 2 },
        { begin: 30, end: 40, degree: 3 },
      ];
      const result = mergeIn(wrapper, 1, 'right');

      // validity test
      checkWrapperValidity(result);
      // check that the size decreased of 1
      assert.equal(result.length, 3);
    });
  });
});
