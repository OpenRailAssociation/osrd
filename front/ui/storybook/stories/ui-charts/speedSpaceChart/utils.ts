import type { SpeedSpaceChartData } from '@osrd-project/ui-charts';

import type { PowerRestriction } from './assets/power_restrictions_PMP_LM';
import type { SpeedLimitTags } from './assets/speed_limit_tags_PMP_LM';
import { electricalProfilesDesignValues } from './consts';
import type { PathProperties, Simulation } from './types';

const convertMsToKmh = (value: number) => value * 3.6;

const convertMmToKM = (value: number) => value / 1000000;

const formatSpeed = (simulationBase: Simulation['base']) => {
  const { positions, speeds } = simulationBase;
  return speeds.map((value, index) => ({
    position: {
      start: convertMmToKM(positions[index]),
    },
    value: convertMsToKmh(value),
  }));
};

const formatEcoSpeeds = (simulationFinalOutput: Simulation['final_output']) => {
  const { positions, speeds } = simulationFinalOutput;
  return speeds.map((value, index) => ({
    position: {
      start: convertMmToKM(positions[index]),
    },
    value: convertMsToKmh(value),
  }));
};

const formatMrsp = (mrsp: Simulation['mrsp']) => {
  const { boundaries, values } = mrsp;
  return {
    boundaries: boundaries.map(convertMmToKM),
    values: values.map((speed, index) => ({
      speed: convertMsToKmh(speed),
      isTemporary: (index + 1) % 4 == 0,
    })),
  };
};

const formatStops = (operationalPoints: PathProperties['operational_points']) =>
  operationalPoints.map(({ position, extensions }) => ({
    position: {
      start: convertMmToKM(position),
    },
    value: {
      name: `${extensions.identifier.name} ${extensions.ch !== '00' ? extensions.ch : ''}`,
      weight: extensions.weight,
    },
  }));

const formatElectrifications = (electrifications: PathProperties['electrifications']) =>
  electrifications.values.map((electrification, index) => ({
    position: {
      start: convertMmToKM(index === 0 ? 0 : electrifications.boundaries[index - 1]),
      end: convertMmToKM(electrifications.boundaries[index]),
    },
    value: {
      type: electrification.type,
      voltage: electrification.voltage!,
      lowerPantograph: electrification.lower_pantograph,
    },
  }));

const formatSlopes = (slopes: PathProperties['slopes']) =>
  slopes.values.map((value, index) => ({
    position: {
      start: convertMmToKM(index === 0 ? 0 : slopes.boundaries[index - 1]),
      end: convertMmToKM(slopes.boundaries[index]),
    },
    value,
  }));

const isNotCompatible = (electrification: string, profile: string) =>
  (electrification === '1500V' && profile?.startsWith('BB')) ||
  (electrification === '25000V' && profile?.startsWith('AA'));

const getProfileValue = (
  electricalProfileType: 'profile' | 'no_profile',
  profile: keyof typeof electricalProfilesDesignValues | null,
  electrification: '1500V' | '25000V'
) => {
  if (electricalProfileType === 'no_profile') {
    return { electricalProfile: 'neutral' };
  }
  if (profile === null || (profile && isNotCompatible(electrification, profile))) {
    return {
      electricalProfile: 'incompatible',
      color: electrification === '1500V' ? 'rgb(171, 201, 133)' : 'rgb(228, 178, 132)',
    };
  }
  return {
    electricalProfile: profile,
    ...electricalProfilesDesignValues[profile!],
  };
};

const formatElectricalProfiles = (
  simulation: Simulation,
  electrifications: SpeedSpaceChartData['electrifications']
) =>
  simulation.electrical_profiles.values.map(({ electrical_profile_type, profile }, index) => {
    const electrification = electrifications.find(
      ({ position }) =>
        position.start >=
          (index === 0 ? 0 : convertMmToKM(simulation.electrical_profiles.boundaries[index - 1])) &&
        position.end! <= convertMmToKM(simulation.electrical_profiles.boundaries[index])
    );

    return {
      position: {
        start: convertMmToKM(
          index === 0 ? 0 : simulation.electrical_profiles.boundaries[index - 1]
        ),
        end: convertMmToKM(simulation.electrical_profiles.boundaries[index]),
      },
      value: getProfileValue(electrical_profile_type, profile!, electrification!.value.voltage!),
    };
  });

const formatPowerRestrictions = (powerRestrictions: PowerRestriction[]) =>
  powerRestrictions.map(({ code, handled, start, stop }) => ({
    position: {
      start: convertMmToKM(start),
      end: convertMmToKM(stop),
    },
    value: {
      powerRestriction: code,
      handled,
    },
  }));

const formatSpeedLimitTags = (speedLimitTags: SpeedLimitTags) =>
  speedLimitTags.values.map(({ tag_name, color }, index) => ({
    position: {
      start: convertMmToKM(speedLimitTags.boundaries[index]),
      end: convertMmToKM(speedLimitTags.boundaries[index + 1]),
    },
    value: {
      tag: tag_name,
      color,
    },
  }));

export const formatData = (
  simulation: Simulation,
  pathProperties: PathProperties,
  powerRestrictionsData: PowerRestriction[],
  speedLimitTagsData: SpeedLimitTags
): SpeedSpaceChartData => {
  const speeds = formatSpeed(simulation.base);
  const ecoSpeeds = formatEcoSpeeds(simulation.final_output);
  const mrsp = formatMrsp(simulation.mrsp);
  const stops = formatStops(pathProperties.operational_points);
  const electrifications = formatElectrifications(pathProperties.electrifications);
  const slopes = formatSlopes(pathProperties.slopes);
  const powerRestrictions = formatPowerRestrictions(powerRestrictionsData);
  const electricalProfiles = formatElectricalProfiles(simulation, electrifications);
  const speedLimitTags = formatSpeedLimitTags(speedLimitTagsData);
  const trainLength = 400;

  return {
    speeds,
    ecoSpeeds,
    mrsp,
    stops,
    electrifications,
    slopes,
    electricalProfiles,
    powerRestrictions,
    speedLimitTags,
    trainLength,
  };
};
