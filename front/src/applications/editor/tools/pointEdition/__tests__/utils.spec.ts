import { describe, it, expect } from 'vitest';

import { formatSignalingSystem } from 'applications/editor/tools/pointEdition/utils';

import type { SignalingSystemForm } from '../types';

describe('formatSignalingSystem', () => {
  it('should handle a BAL signal without default_parameters', () => {
    const signalingSystem: SignalingSystemForm = {
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      conditional_parameters: [],
    };
    const result = formatSignalingSystem(signalingSystem);
    expect(result).toEqual({
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      default_parameters: { jaune_cli: 'false' },
      conditional_parameters: [],
    });
  });

  it('should handle a BAL signal with default_parameters', () => {
    const signalingSystem: SignalingSystemForm = {
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      default_parameters: { jaune_cli: 'true' },
      conditional_parameters: [],
    };
    const result = formatSignalingSystem(signalingSystem);
    expect(result).toEqual({
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      default_parameters: { jaune_cli: 'true' },
      conditional_parameters: [],
    });
  });

  it('should handle a BAL signal with conditional_parameters', () => {
    const signalingSystem: SignalingSystemForm = {
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      conditional_parameters: [
        {
          on_route: 'route1',
          parameters: { jaune_cli: 'true' },
        },
        {
          on_route: 'route2',
          parameters: { jaune_cli: 'false' },
        },
      ],
    };
    const result = formatSignalingSystem(signalingSystem);
    expect(result).toEqual({
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      default_parameters: { jaune_cli: 'false' },
      conditional_parameters: [
        {
          on_route: 'route1',
          parameters: { jaune_cli: 'true' },
        },
        {
          on_route: 'route2',
          parameters: { jaune_cli: 'false' },
        },
      ],
    });
  });

  it('should handle a BAL signal with default_parameters and conditional_parameters becoming a BAPR signal', () => {
    const signalingSystem: SignalingSystemForm = {
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      default_parameters: { jaune_cli: 'true' },
      conditional_parameters: [
        {
          on_route: 'route1',
          parameters: { jaune_cli: 'true' },
        },
        {
          on_route: 'route2',
          parameters: { jaune_cli: 'false' },
        },
      ],
    };
    const result = formatSignalingSystem({ ...signalingSystem, signaling_system: 'BAPR' });
    expect(result).toEqual({
      next_signaling_systems: [],
      signaling_system: 'BAPR',
      settings: { Nf: 'false', distant: 'false' },
      default_parameters: {},
      conditional_parameters: [],
    });
  });

  it('should handle a BAPR signal becoming a BAL signal', () => {
    const signalingSystem: SignalingSystemForm = {
      next_signaling_systems: [],
      signaling_system: 'BAPR',
      settings: { Nf: 'false', distant: 'false' },
      conditional_parameters: [],
    };
    const result = formatSignalingSystem({ ...signalingSystem, signaling_system: 'BAL' });
    expect(result).toEqual({
      next_signaling_systems: [],
      signaling_system: 'BAL',
      settings: { Nf: 'false' },
      default_parameters: { jaune_cli: 'false' },
      conditional_parameters: [],
    });
  });

  it('should handle a updated BAPR signal', () => {
    const signalingSystem: SignalingSystemForm = {
      next_signaling_systems: [],
      signaling_system: 'BAPR',
      settings: { Nf: 'true', distant: 'false' },
      conditional_parameters: [],
    };
    const result = formatSignalingSystem({
      ...signalingSystem,
      settings: { ...signalingSystem.settings, distant: 'true' },
    });
    expect(result).toEqual({
      next_signaling_systems: [],
      signaling_system: 'BAPR',
      settings: { Nf: 'true', distant: 'true' },
      default_parameters: {},
      conditional_parameters: [],
    });
  });
});

// TVM signaling systems were not tested, as the data system now includes TVM300 and TVM430 systems.
// TODO - add TVM300 and TVM430 tests
