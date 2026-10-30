import { useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { RequiredInput } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { getFeatureFlag } from 'reducers/user/userSelectors';

type PathStepSubFormFieldsProps = {
  pathStep: PathStepV2;
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
  const [subFormCountryCode, setSubFormCountryCode] = useState<string>(defaultCountryCode);
  const [subFormMainCode, setSubFormMainCode] = useState<string>(defaultMainCode);
  const [subFormSecondaryCode, setSubFormSecondaryCode] = useState<string>(defaultSecondaryCode);

  return (
    <div className="path-step-subform-domestic-fields">
      <div className="path-step-subform-field">
        <RequiredInput className="path-step-subform-required-input" size="sm"></RequiredInput>
        <Input
          id={`path-step-subform-country-code-${pathStep.key}`}
          label={t('countryCode')}
          readOnly={isOpValid}
          small
          value={subFormCountryCode}
          onChange={(e) => setSubFormCountryCode(e.target.value)}
        />
      </div>
      <div className="path-step-subform-field">
        <RequiredInput className="path-step-subform-required-input" size="sm"></RequiredInput>
        <Input
          id={`path-step-subform-main-code-${pathStep.key}`}
          label={t('primaryCode')}
          readOnly={isOpValid}
          small
          value={subFormMainCode}
          onChange={(e) => setSubFormMainCode(e.target.value)}
        />
      </div>
      <div className="path-step-subform-field">
        <Input
          id={`pathStep-subform-secondary-code-${pathStep.key}`}
          label={t('secondaryCode')}
          readOnly={isOpValid}
          small
          value={subFormSecondaryCode}
          onChange={(e) => setSubFormSecondaryCode(e.target.value)}
        />
      </div>
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
  const [subFormUicCode, setSubFormUicCode] = useState<string>(defaultUicCode);
  const [subFormSecondaryCode, setSubFormSecondaryCode] = useState<string>(defaultSecondaryCode);

  return (
    <div className="path-step-subform-uic-fields">
      <div className="path-step-subform-field">
        <Input
          id={`path-step-subform-uic-code-${pathStep.key}`}
          label={t('uicCode')}
          readOnly={isOpValid}
          small
          value={subFormUicCode}
          onChange={(e) => setSubFormUicCode(e.target.value)}
        />
      </div>
      <div className="path-step-subform-field">
        <Input
          id={`pathStep-subform-secondary-code-${pathStep.key}`}
          label={t('secondaryCode')}
          readOnly={isOpValid}
          small
          value={subFormSecondaryCode}
          onChange={(e) => setSubFormSecondaryCode(e.target.value)}
        />
      </div>
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
  const [subFormOpIdCode, setSubFormOpIdCode] = useState<string>(defaultOpIdCode);

  return (
    <div className="path-step-subform-op-id-fields">
      <div className="path-step-subform-field">
        <Input
          id={`path-step-subform-op-id-code-${pathStep.key}`}
          label={t('opIdCode')}
          readOnly={isOpValid}
          small
          value={subFormOpIdCode}
          onChange={(e) => setSubFormOpIdCode(e.target.value)}
        />
      </div>
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
  const [subFormOffset, setSubFormOffset] = useState<string>(defaultOffset);
  const [subFormTrackId, setSubFormTrackId] = useState<string>(defaultTrack);

  return (
    <div className="path-step-subform-track-offset-fields">
      <div className="path-step-subform-field">
        <Input
          id={`path-step-subform-offset-${pathStep.key}`}
          label={t('offset')}
          readOnly={isOpValid}
          small
          value={subFormOffset}
          onChange={(e) => setSubFormOffset(e.target.value)}
        />
      </div>
      <div className="path-step-subform-field">
        <Input
          id={`pathStep-subform-track-id-${pathStep.key}`}
          label={t('trackId')}
          readOnly={isOpValid}
          small
          value={subFormTrackId}
          onChange={(e) => setSubFormTrackId(e.target.value)}
        />
      </div>
    </div>
  );
};

type PathStepSubFormProps = {
  pathStep: PathStepV2;
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

  const [subFormName, setSubFormName] = useState<string>(defaultName);

  if (!unrecognizedWaypointsActivated || !isSubFormExpanded) return;

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
          value={subFormName}
          onChange={(e) => setSubFormName(e.target.value)}
        />
        <SpecificFields pathStep={pathStep} isOpValid={isOpValid} />
      </div>
    </div>
  );
};

export default PathStepSubForm;
