import * as assert from 'assert';
import { tail, last, omit } from 'lodash';
import distance from '@turf/distance';
import length from '@turf/length';
import along from '@turf/along';

import { LinearMetadataItem, update, resizeSegment, splitAt, mergeIn } from './data';

const DEBUG = false;

interface Degree {
  degree: number;
}

const simpleLine = {
  type: 'LineString',
  coordinates: [
    [-1.55731201171875, 47.210240027362104],
    [-0.560302734375, 47.47173459547315],
  ],
};

const complexeLine = {
  type: 'LineString',
  coordinates: [
    [-1.5416908264160156, 47.21717794690891],
    [-1.5247821807861328, 47.220675713408426],
    [-1.512765884399414, 47.22254109452638],
    [-1.5050411224365234, 47.22568877633443],
    [-1.5014362335205078, 47.229302550889734],
    [-1.4915657043457031, 47.23472275076704],
    [-1.441526412963867, 47.265368501128926],
    [-1.4008426666259763, 47.28988397829794],
    [-1.3797283172607422, 47.2958800972544],
    [-1.3605022430419922, 47.30589151822937],
    [-1.3553524017333984, 47.310663737638244],
    [-1.3509750366210938, 47.31357341605936],
    [-1.3391304016113281, 47.320846911252495],
    [-1.332392692565918, 47.32398875148795],
    [-1.3277363777160645, 47.32755218670456],
    [-1.3100337982177734, 47.33690324274538],
    [-1.306471824645996, 47.34001504658135],
    [-1.3038969039916992, 47.34138185571577],
    [-1.3013434410095215, 47.342108867434504],
    [-1.2984466552734375, 47.34258868968457],
    [-1.2858295440673828, 47.34389727365561],
    [-1.2713027000427246, 47.34542391395829],
    [-1.2511968612670898, 47.3476047520891],
    [-1.2486863136291502, 47.34830260126135],
    [-1.2460899353027344, 47.34939297212208],
    [-1.2430858612060545, 47.350468782627765],
    [-1.233065128326416, 47.353318120710746],
    [-1.2229585647583008, 47.358202342378284],
    [-1.2193536758422852, 47.35914715450116],
    [-1.196737289428711, 47.363304126849265],
    [-1.185150146484375, 47.367082908390685],
    [-1.1779403686523438, 47.36943724309075],
  ],
};

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
        const result = resizeSegment(wrapper, 0, 10);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });

    it('decrease should fail on wrapper of size 1', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [{ begin: 0, end: 10, degree: 0 }];
      try {
        const result = resizeSegment(wrapper, 0, -5);
        assert.fail();
      } catch (e) {
        assert.ok(e);
      }
    });

    it('increase on the last item (means increase the length) should', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = resizeSegment(wrapper, 3, 5);

      assert.equal(result[3].end, 45);
    });

    it('decrease on the last item (means reducing the length) should work', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      const result = resizeSegment(wrapper, 3, -5);

      assert.equal(result[3].end, 35);
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
      assert.equal(result[2].begin, 20);
      assert.equal(result[2].end, 35);
      // check the increase of the last element
      assert.equal(result[3].begin, 35);
      assert.equal(result[3].end, 40);
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
      assert.equal(result[2].begin, 20);
      assert.equal(result[2].end, 25);
      // check the decrease of the last element
      assert.equal(result[3].begin, 25);
      assert.equal(result[3].end, 40);
    });

    it('decrease more than the element size should fail', () => {
      const wrapper: Array<LinearMetadataItem<Degree>> = [
        { begin: 0, end: 10, degree: 0 },
        { begin: 10, end: 20, degree: 0 },
        { begin: 20, end: 30, degree: 0 },
        { begin: 30, end: 40, degree: 0 },
      ];
      try {
        const result = resizeSegment(wrapper, 3, -10);
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
        const result = resizeSegment(wrapper, 1, 10);
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
        const result = resizeSegment(wrapper, 3, -5);
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
