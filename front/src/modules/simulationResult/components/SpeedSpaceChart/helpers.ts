/* eslint-disable import/prefer-default-export */
import type {
  LayerData,
  Data,
  ElectrificationValues,
  PowerRestrictionValues,
  ElectricalPofilelValues,
  SpeedLimitTagValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';

import type {
  PathPropertiesFormatted,
  PositionData,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { ReportTrainV2 } from 'common/api/generatedEditoastApi';
import { mmToKm, msToKmh, mToKm } from 'utils/physics';

import { electricalProfilesDesignValues } from './consts';

export const formatSpeeds = (simulation: ReportTrainV2) => {
  const { positions, speeds } = simulation;
  return speeds.map((value, index) => ({
    position: {
      start: mmToKm(positions[index]),
    },
    value: msToKmh(value),
  }));
};

export const formatStops = (operationalPoints: PathPropertiesFormatted['operationalPoints']) =>
  operationalPoints.map(({ position, extensions: { identifier, sncf } = {} }) => ({
    position: {
      start: mmToKm(position),
    },
    value:
      identifier && sncf ? `${identifier.name} ${sncf.ch !== ('' || '00') ? sncf.ch : ''}` : '',
  }));

export const formatElectrifications = (
  electrifications: PathPropertiesFormatted['electrifications']
) =>
  electrifications.map(({ electrificationUsage, start, stop }) => ({
    position: {
      start: mToKm(start),
      end: mToKm(stop),
    },
    value: {
      type: electrificationUsage.type,
      voltage:
        'voltage' in electrificationUsage
          ? (electrificationUsage.voltage as ElectrificationValues['voltage'])
          : undefined,
      lowerPantograph:
        'lower_pantograph' in electrificationUsage ? electrificationUsage.lower_pantograph : false,
    },
  }));

export const formatSlopes = (slopes: PositionData<'gradient'>[]) => {
  let actualSlopes: LayerData<number>[] = [];
  if (slopes)
    actualSlopes = slopes.map((slope, index) => ({
      position: {
        start: mToKm(index === 0 ? 0 : slopes[index - 1].position),
        end: mToKm(slope.position),
      },
      value: slope.gradient,
    }));
  return actualSlopes;
};

export const getProfileValue = (
  electricalProfileValue: SimulationResponseSuccess['electrical_profiles']['values'][number],
  voltage?: '1500V' | '25000V'
) => {
  if (electricalProfileValue.electrical_profile_type === 'no_profile') {
    return { electricalProfile: 'neutral' };
  }
  if (
    !electricalProfileValue.handled ||
    !electricalProfileValue.profile ||
    electricalProfileValue.profile === null
  ) {
    return {
      electricalProfile: 'incompatible',
      color:
        voltage === '1500V'
          ? electricalProfilesDesignValues.F.color
          : electricalProfilesDesignValues['20000V'].color,
    };
  }
  return {
    electricalProfile: electricalProfileValue.profile,
    ...electricalProfilesDesignValues[
      electricalProfileValue.profile as keyof typeof electricalProfilesDesignValues
    ],
  };
};

export const formatElectricalProfiles = (
  electricalProfiles: SimulationResponseSuccess['electrical_profiles'],
  electrifications: Data['electrifications'],
  pathLength: number
) => {
  if (electricalProfiles.values.length === 0) return undefined;
  const { boundaries, values } = electricalProfiles;
  return values.map((value, index) => {
    const electrification = electrifications.find(
      (electrificationValue) =>
        electrificationValue.position.start >= (index === 0 ? 0 : mmToKm(boundaries[index - 1])) &&
        electrificationValue.position.end! <=
          mmToKm(index === boundaries.length ? pathLength : boundaries[index])
    );

    return {
      position: {
        start: mmToKm(index === 0 ? 0 : boundaries[index - 1]),
        end: mmToKm(index === boundaries.length ? pathLength : boundaries[index]),
      },
      value: getProfileValue(value, electrification?.value.voltage),
    };
  });
};

export const formatData = (
  simulation: SimulationResponseSuccess,
  selectedTrainPowerRestrictions?: LayerData<PowerRestrictionValues>[],
  pathProperties?: PathPropertiesFormatted
) => {
  const pathLength = simulation.base.positions[simulation.base.positions.length - 1];
  const speeds: LayerData<number>[] = formatSpeeds(simulation.base);
  const ecoSpeeds: LayerData<number>[] = formatSpeeds(simulation.final_output);
  const stops: LayerData<string>[] = formatStops(pathProperties!.operationalPoints);
  const electrifications: LayerData<ElectrificationValues>[] = formatElectrifications(
    pathProperties!.electrifications
  );
  const slopes: LayerData<number>[] = formatSlopes(pathProperties!.slopes);
  const powerRestrictions: LayerData<PowerRestrictionValues>[] | undefined =
    selectedTrainPowerRestrictions;
  const electricalProfiles: LayerData<ElectricalPofilelValues>[] | undefined =
    formatElectricalProfiles(simulation.electrical_profiles, electrifications, pathLength);
  const speedLimitTags: LayerData<SpeedLimitTagValues>[] | undefined = undefined;

  return {
    speeds,
    ecoSpeeds,
    stops,
    electrifications,
    slopes,
    electricalProfiles,
    powerRestrictions,
    speedLimitTags,
  };
};
