import { describe, test, expect } from 'vitest';

import { initialState } from 'modules/pathfinding/consts';
import { reducer } from 'modules/pathfinding/hooks/usePathfinding';
import type { PathfindingAction } from 'modules/pathfinding/types';
import rollingStock from 'modules/rollingStock/components/RollingStockSelector/sampleData';

import { origin, destination } from './data';

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
  test('pathfinding got started, previously cancelled', () => {
    const state = {
      ...initialState,
      cancelled: true,
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_STARTED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      running: true,
      cancelled: false,
      mustBeLaunched: false,
    });
  });
  test('pathfinding cancelled', () => {
    const state = {
      ...initialState,
      running: true,
      done: true,
      error: 'abcd',
      mustBeLaunched: true,
      cancelled: false,
    };
    const action = { type: 'PATHFINDING_CANCELLED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      running: false,
      done: false,
      error: '',
      mustBeLaunched: false,
      cancelled: true,
    });
  });
  test('pathfinding got started, previously in error', () => {
    const state = {
      ...initialState,
      error: 'true',
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_STARTED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      running: true,
      error: '',
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
  test('pathfinding request finished, but user cancelled before it ended', () => {
    const state = {
      ...initialState,
      cancelled: true,
      mustBeLaunched: true,
    };
    const action = { type: 'PATHFINDING_FINISHED' };
    expect(reducer(state, action)).toEqual({
      ...initialState,
      done: false,
      running: false,
      mustBeLaunched: false,
      cancelled: true,
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
      done: false,
      running: false,
      mustBeLaunched: false,
    });
  });
  describe('origin/destination/rolling stock/infra changed', () => {
    test('origin missing', () => {
      const state = initialState;
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin: null,
          destination,
          rollingStock,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        missingParam: true,
      });
    });
    test('destination missing', () => {
      const state = initialState;
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination: null,
          rollingStock,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        missingParam: true,
      });
    });
    test('rollingStock missing, previously done', () => {
      const state = {
        ...initialState,
        done: true,
      };
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        error: '',
        done: false,
        missingParam: true,
      });
    });
    test('rollingStock missing, previously in error', () => {
      const state = {
        ...initialState,
        error: 'error',
      };
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        error: '',
        missingParam: true,
      });
    });
    test('rollingStock missing', () => {
      const state = initialState;
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
        },
      };
      expect(reducer(state, action)).toEqual({
        ...initialState,
        missingParam: true,
      });
    });
    test('all 4 are there', () => {
      const state = {
        ...initialState,
        missingParam: true,
      };
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
          rollingStock,
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
      const action: PathfindingAction = {
        type: 'PATHFINDING_PARAM_CHANGED',
        params: {
          origin,
          destination,
          rollingStock,
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
});
