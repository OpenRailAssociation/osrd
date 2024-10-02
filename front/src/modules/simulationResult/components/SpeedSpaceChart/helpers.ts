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
import type { ReportTrain } from 'common/api/osrdEditoastApi';
import { TAG_COLORS } from 'modules/simulationResult/consts';
import type { SpeedLimitTagValue } from 'modules/simulationResult/types';
import { mmToKm, msToKmh, mToKm } from 'utils/physics';

import { electricalProfilesDesignValues } from './consts';

const getTag = (source?: SpeedLimitTagValue['source']): { name: string; color: string } => {
  let name: string;
  let color: string;

  switch (source?.speed_limit_source_type) {
    case 'given_train_tag':
      name = source.tag;
      color = TAG_COLORS.GIVEN_TRAIN;
      break;
    case 'fallback_tag':
      name = source.tag;
      color = TAG_COLORS.FALLBACK;
      break;
    case 'unknown_tag':
      name = 'incompatible';
      color = TAG_COLORS.INCOMPATIBLE;
      break;
    default:
      name = 'missing_from_train';
      color = TAG_COLORS.MISSING;
  }

  return { name, color };
};

const formatSpeedLimitTags = (
  rawSpeedLimitTags: SimulationResponseSuccess['mrsp'],
  pathLength: number
): LayerData<SpeedLimitTagValues>[] =>
  rawSpeedLimitTags.values.reduce((mergedPositions, value, index) => {
    const { name, color } = getTag(value.source);

    if (name === 'missing_from_train') return mergedPositions;

    const start = index === 0 ? 0 : rawSpeedLimitTags.boundaries[index - 1];
    const end =
      index === rawSpeedLimitTags.values.length - 1
        ? pathLength
        : rawSpeedLimitTags.boundaries[index];

    const newPosition = {
      position: {
        start: mmToKm(start),
        end: mmToKm(end),
      },
      value: {
        tag: name,
        color,
      },
    };

    const lastPosition = mergedPositions.at(-1);
    if (
      lastPosition &&
      lastPosition.value.tag === newPosition.value.tag &&
      lastPosition.value.color === newPosition.value.color &&
      lastPosition.position.end === newPosition.position.start
    ) {
      lastPosition.position.end = newPosition.position.end;
    } else {
      mergedPositions.push(newPosition);
    }
    return mergedPositions;
  }, [] as LayerData<SpeedLimitTagValues>[]);

export const formatSpeeds = (simulation: ReportTrain) => {
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
    value: identifier
      ? `${identifier.name} ${sncf?.ch && sncf.ch !== ('' || '00') ? sncf.ch : ''}`
      : '',
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
  const speedLimitTags: LayerData<SpeedLimitTagValues>[] | undefined = formatSpeedLimitTags(
    simulation.mrsp,
    pathLength
  );
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
