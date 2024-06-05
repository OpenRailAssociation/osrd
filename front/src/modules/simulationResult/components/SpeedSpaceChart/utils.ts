import * as d3 from 'd3';

import type {
  ElectrificationRangeV2,
  PathPropertiesFormatted,
  PositionData,
} from 'applications/operationalStudies/types';
import type { SimulationPowerRestrictionRange } from 'common/api/osrdEditoastApi';
import i18n from 'i18n';
import type {
  GradientPosition,
  HeightPosition,
  RadiusPosition,
} from 'reducers/osrdsimulation/types';

import {
  electricalProfileColorsWithProfile,
  electricalProfileColorsWithoutProfile,
} from './consts';
import type { AC, DC, ElectricalConditionSegmentV2, PowerRestrictionSegment } from './types';

const calculateReferentialHeight = (data: number[]) => {
  const maxRef = d3.max(data);
  const minRef = d3.min(data);
  let refHeight = 0;
  if (maxRef !== undefined && minRef !== undefined) {
    refHeight = maxRef - minRef;
  }
  return refHeight;
};

export const createCurveCurve = (
  curves: RadiusPosition[] | PositionData<'radius'>[], // TODO DROPV1 : remove RadiusPosition type
  speeds: number[]
): RadiusPosition[] => {
  const referentialHeight = calculateReferentialHeight(speeds);
  const maxRadius = d3.max(curves.map((step) => step.radius));
  const minRadius = d3.min(curves.map((step) => step.radius));
  let dataHeight = 0;
  if (maxRadius !== undefined && minRadius !== undefined) {
    dataHeight = maxRadius - minRadius;
  }
  return curves.map((step) => ({
    ...step,
    radius: step.radius > 0 ? (step.radius * referentialHeight) / dataHeight : 0,
  }));
};

/**
 * Create the altitude curve based from the slopes data
 */
export const createSlopeCurve = (
  slopes: GradientPosition[] | PositionData<'gradient'>[],
  gradients: number[]
): HeightPosition[] => {
  const slopesCurve: HeightPosition[] = [];
  slopes.forEach((step, idx) => {
    if (idx % 2 === 0 && slopes[idx + 1]) {
      if (idx === 0) {
        slopesCurve.push({ height: 0, position: step.position });
      } else {
        const distance = step.position - slopesCurve[slopesCurve.length - 1].position;
        const height =
          (distance * slopes[idx - 2].gradient) / 1000 + slopesCurve[slopesCurve.length - 1].height;
        slopesCurve.push({ height, position: step.position });
      }
    }
  });
  const referentialHeight = calculateReferentialHeight(gradients);
  const maxRadius = d3.max(slopesCurve.map((step) => step.height));
  const minRadius = d3.min(slopesCurve.map((step) => step.height));
  let dataHeight = 0;
  if (maxRadius !== undefined && minRadius !== undefined) {
    dataHeight = maxRadius - minRadius;
  }
  return slopesCurve.map((step) => ({
    ...step,
    height: (step.height * referentialHeight) / dataHeight,
  }));
};

export const createProfileSegmentV2 = (
  fullElectrificationRange: ElectrificationRangeV2[],
  electrificationRange: ElectrificationRangeV2
) => {
  const electrification = electrificationRange.electrificationUsage;
  const segment: ElectricalConditionSegmentV2 = {
    position_start: electrificationRange.start,
    position_end: electrificationRange.stop,
    position_middle: (electrificationRange.start + electrificationRange.stop) / 2,
    lastPosition: fullElectrificationRange.slice(-1)[0].stop,
    height_start: 4,
    height_end: 24,
    height_middle: 14,
    electrification,
    color: '',
    textColor: '',
    text: '',
    isStriped: false,
    isIncompatibleElectricalProfile: false,
    isRestriction: false,
    isIncompatiblePowerRestriction: false,
  };

  // add colors to object depending of the type of electrification
  if (electrification.type === 'electrification') {
    const { voltage } = electrification;

    if (electrification.electrical_profile_type === 'profile' && electrification.profile) {
      const { profile, handled } = electrification;
      segment.color =
        electricalProfileColorsWithProfile[voltage as keyof unknown][
          profile as string | keyof AC | keyof DC
        ];
      if (handled) {
        segment.text = `${voltage} ${profile}`;
      } else {
        // compatible electric mode, with uncompatible profile
        segment.isIncompatibleElectricalProfile = true;
        segment.isStriped = true;
        segment.text = `${voltage}, ${i18n.t('electricalProfiles.incompatibleProfile', {
          ns: 'simulation',
        })}`;
      }
    } else {
      segment.color =
        electricalProfileColorsWithoutProfile[
          voltage as keyof typeof electricalProfileColorsWithoutProfile
        ];

      // compatible electric mode, but missing profile
      segment.text = voltage;
      segment.isStriped = true;
    }

    segment.textColor =
      electricalProfileColorsWithoutProfile[
        voltage as keyof typeof electricalProfileColorsWithoutProfile
      ];
  } else if (electrification.type === 'neutral_section') {
    segment.text = 'Neutral';
    segment.color = '#000000';
    segment.textColor = '#000000';
  } else {
    segment.text = 'NonElectrified';
    segment.color = '#000000';
    segment.textColor = '#000';
  }

  return segment;
};

export const createPowerRestrictionSegment = (
  fullPowerRestrictionRange: SimulationPowerRestrictionRange[],
  powerRestrictionRange: SimulationPowerRestrictionRange
) => {
  // figure out if the power restriction is incompatible or missing`
  const isRestriction = powerRestrictionRange.handled;
  const isIncompatiblePowerRestriction = !!powerRestrictionRange.code;
  const isStriped = !powerRestrictionRange.code || !powerRestrictionRange.handled;

  const segment: PowerRestrictionSegment = {
    position_start: powerRestrictionRange.start,
    position_end: powerRestrictionRange.stop,
    position_middle: (powerRestrictionRange.start + powerRestrictionRange.stop) / 2,
    lastPosition: fullPowerRestrictionRange.slice(-1)[0].stop,
    height_start: 4,
    height_end: 24,
    height_middle: 14,
    seenRestriction: powerRestrictionRange.code || '',
    usedRestriction: powerRestrictionRange.handled,
    isStriped,
    isRestriction,
    isIncompatiblePowerRestriction,
  };

  return segment;
};

/**
 * Check if the train (in case of bimode rolling stock) runs in thermal mode on the whole path
 * @param electricRanges all of the different path's ranges.
 * If the range is electrified and the train us the eletrical mode, mode_handled is true
 */
export const runsOnlyThermal = (electricRanges: PathPropertiesFormatted['electrifications']) =>
  // TODO TS2 : what to do with handled ?
  !electricRanges.some(
    (range) => range.electrificationUsage.type === 'electrification'
    //    &&
    //     range.electrificationUsage.mode_handled
  );
