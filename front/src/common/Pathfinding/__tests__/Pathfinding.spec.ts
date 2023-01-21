import { reducer, initialState } from '../Pathfinding';

describe('reducer', () => {
  test('pathfinding got started', () => {
    const state = {
      ...initialState,
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_STARTED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      running: true,
      mustBeLaunched: false,
    });
  });
  test('pathfinding got started, previously done', () => {
    const state = {
      ...initialState,
      done: true,
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_STARTED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      running: true,
      done: false,
      mustBeLaunched: false,
    });
  });
  test('pathfinding finished', () => {
    const state = {
      ...initialState,
      running: true,
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_FINISHED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      done: true,
      running: false,
      mustBeLaunched: false,
    });
  });
  test('pathfinding finished running, previously in error', () => {
    const state = {
      ...initialState,
      error: 'some constraint',
      running: true,
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_FINISHED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      error: '',
      done: true,
      running: false,
      mustBeLaunched: false,
    });
  });
  test('pathfinding finished running with an error', () => {
    const state = {
      ...initialState,
      running: true,
      error: 'some constraint',
    };
    const action = { type: 'PATHFINDING_ERROR', message: 'error message auietsrn' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      error: 'error message auietsrn',
      done: true,
      running: false,
      mustBeLaunched: false,
    });
  });
  describe('origin/destination/rolling stock changed', () => {
    test('origin missing', () => {
      const state = initialState;
      const action = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          destination: { id: '1234' },
          rollingStockID: 666,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        missingParam: true,
      });
    });
    test('destination missing', () => {
      const state = initialState;
      const action = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin: { id: '1234' },
          rollingStockID: 666,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        missingParam: true,
      });
    });
    test('rollingStock missing', () => {
      const state = initialState;
      const action = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin: { id: '1234' },
          destination: { id: '5678' },
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        missingParam: true,
      });
    });
    test('all three are there', () => {
      const state = {
        ...initialState,
        missingParam: true,
      };
      const action = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin: { id: '1234' },
          destination: { id: '5678' },
          rollingStockID: 123,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        mustBeLaunched: true,
        missingParam: false,
      });
    });
    test('must not start if already running', () => {
      const state = {
        ...initialState,
        running: true,
        done: false,
      };
      const action = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin: { id: '1234' },
          destination: { id: '5678' },
          rollingStockID: 123,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        running: true,
        done: false,
        mustBeLaunched: false,
      });
    });
  });
  describe('vias changed', () => {
    test('vias not empty', () => {
      const state = initialState;
      const action = {
        type: 'VIAS_CHANGED',
        params: {
          vias: [{ id: 'auie' }],
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        mustBeLaunchedManually: true,
      });
    });
    test('vias empty', () => {
      const state = initialState;
      const action = {
        type: 'VIAS_CHANGED',
        params: {
          vias: [],
        },
      };
      expect(reducer(state, action)).toEqual(initialState);
    });
  });
});
