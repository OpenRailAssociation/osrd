import { useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { PathStepMetadata, PathStep } from 'reducers/osrdconf/types';
import { getFeatureFlag } from 'reducers/user/userSelectors';

type PathStepSubFormFieldsProps = {
  pathStep: PathStep;
  isOpValid: boolean;
};

const DomesticFields = ({ pathStep, isOpValid }: PathStepSubFormFieldsProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const loc = pathStep.location;
  const defaultCountryCode =
    loc?.type === 'operational_point_part_reference' && loc.operational_point.type === 'domestic'
      ? loc.operational_point.country_code
      : '';
  const defaultMainCode =
    loc?.type === 'operational_point_part_reference' && loc?.operational_point.type === 'domestic'
      ? loc.operational_point.main_code
      : '';
  const defaultSecondaryCode =
    loc?.type === 'operational_point_part_reference' &&
    loc?.operational_point.type === 'domestic' &&
    loc.operational_point.secondary_code
      ? loc.operational_point.secondary_code
      : '';
  const [subFormCountryCode, setSubFormCountryCode] = useState<string>('');
  const [subFormMainCode, setSubFormMainCode] = useState<string>('');
  const [subFormSecondaryCode, setSubFormSecondaryCode] = useState<string>('');

  return (
    <div className="path-step-subform-specific-fields path-step-subform-domestic-fields">
      <Input
        id={`path-step-subform-country-code-${pathStep.key}`}
        label={t('countryCode')}
        readOnly={isOpValid}
        small
        required
        value={isOpValid ? defaultCountryCode : subFormCountryCode}
        onChange={(e) => setSubFormCountryCode(e.target.value)}
      />
      <Input
        id={`path-step-subform-main-code-${pathStep.key}`}
        label={t('primaryCode')}
        readOnly={isOpValid}
        small
        required
        value={isOpValid ? defaultMainCode : subFormMainCode}
        onChange={(e) => setSubFormMainCode(e.target.value)}
      />
      <Input
        id={`path-step-subform-secondary-code-${pathStep.key}`}
        label={t('secondaryCode')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultSecondaryCode : subFormSecondaryCode}
        onChange={(e) => setSubFormSecondaryCode(e.target.value)}
      />
    </div>
  );
};

const UicFields = ({ pathStep, isOpValid }: PathStepSubFormFieldsProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const loc = pathStep.location;
  const defaultUicCode =
    loc?.type === 'operational_point_part_reference' && loc?.operational_point.type === 'uic'
      ? loc.operational_point.uic.toString()
      : '';
  const defaultSecondaryCode =
    loc?.type === 'operational_point_part_reference' &&
    loc?.operational_point.type === 'uic' &&
    loc.operational_point.secondary_code
      ? loc.operational_point.secondary_code
      : '';
  const [subFormUicCode, setSubFormUicCode] = useState<string>('');
  const [subFormSecondaryCode, setSubFormSecondaryCode] = useState<string>('');

  return (
    <div className="path-step-subform-specific-fields path-step-subform-uic-fields">
      <Input
        id={`path-step-subform-uic-code-${pathStep.key}`}
        label={t('uicCode')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultUicCode : subFormUicCode}
        onChange={(e) => setSubFormUicCode(e.target.value)}
      />
      <Input
        id={`path-step-subform-secondary-code-${pathStep.key}`}
        label={t('secondaryCode')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultSecondaryCode : subFormSecondaryCode}
        onChange={(e) => setSubFormSecondaryCode(e.target.value)}
      />
    </div>
  );
};

const OpIdFields = ({ pathStep, isOpValid }: PathStepSubFormFieldsProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const loc = pathStep.location;
  const defaultOpIdCode =
    loc?.type === 'operational_point_part_reference' && loc.operational_point.type === 'id'
      ? loc.operational_point.operational_point
      : '';
  const [subFormOpIdCode, setSubFormOpIdCode] = useState<string>('');

  return (
    <div className="path-step-subform-specific-fields path-step-subform-op-id-fields">
      <Input
        id={`path-step-subform-op-id-code-${pathStep.key}`}
        label={t('opIdCode')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultOpIdCode : subFormOpIdCode}
        onChange={(e) => setSubFormOpIdCode(e.target.value)}
      />
    </div>
  );
};

const TrackOffsetFields = ({ pathStep, isOpValid }: PathStepSubFormFieldsProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const loc = pathStep.location;
  const defaultOffset = loc?.type === 'track_offset' ? (loc.offset / 1000).toString() : '';
  const defaultTrack = loc?.type === 'track_offset' ? loc.track : '';
  const [subFormOffset, setSubFormOffset] = useState<string>('');
  const [subFormTrackId, setSubFormTrackId] = useState<string>('');

  return (
    <div className="path-step-subform-specific-fields path-step-subform-track-offset-fields">
      <Input
        id={`path-step-subform-offset-${pathStep.key}`}
        label={t('offset')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultOffset : subFormOffset}
        onChange={(e) => setSubFormOffset(e.target.value)}
      />
      <Input
        id={`path-step-subform-track-id-${pathStep.key}`}
        label={t('trackId')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultTrack : subFormTrackId}
        onChange={(e) => setSubFormTrackId(e.target.value)}
      />
    </div>
  );
};

type PathStepSubFormProps = {
  pathStep: PathStep;
  pathStepMetadata: PathStepMetadata | undefined;
  isSubFormExpanded: boolean;
  isOpValid: boolean;
};

const PathStepSubForm = ({
  pathStep,
  pathStepMetadata,
  isSubFormExpanded,
  isOpValid,
}: PathStepSubFormProps) => {
  const unrecognizedWaypointsActivated = useSelector(getFeatureFlag('unrecognizedWaypoints'));
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const loc = pathStep.location;
  const defaultName =
    pathStepMetadata?.validity === 'valid' && pathStepMetadata.type === 'opRef'
      ? pathStepMetadata.name
      : '';

  const [subFormName, setSubFormName] = useState<string>('');

  if (!unrecognizedWaypointsActivated || !isSubFormExpanded) return;

  // const whichFields = () => {
  //   if (loc?.type === 'track_offset') return TrackOffsetFields;
  //   if (loc?.operational_point.type === 'uic') return UicFields;
  //   if (loc?.operational_point.type === 'id') return OpIdFields;
  //   return DomesticFields;
  // };

  const SpecificFields =
    loc?.type === 'track_offset'
      ? TrackOffsetFields
      : loc?.operational_point.type === 'uic'
        ? UicFields
        : loc?.operational_point.type === 'id'
          ? OpIdFields
          : DomesticFields;

  return (
    <div className="path-step-subform-wrapper">
      <div className="path-step-subform-content">
        <Input
          id={`path-step-subform-name-${pathStep.key}`}
          label={t('name')}
          readOnly={isOpValid}
          small
          value={isOpValid ? defaultName : subFormName}
          onChange={(e) => setSubFormName(e.target.value)}
        />
        <SpecificFields pathStep={pathStep} isOpValid={isOpValid} />
      </div>
    </div>
  );
};

export default PathStepSubForm;
