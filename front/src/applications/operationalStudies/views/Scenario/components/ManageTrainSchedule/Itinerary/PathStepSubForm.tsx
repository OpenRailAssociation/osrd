import { useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { OperationalPointReference, TrackOffset } from 'common/api/osrdEditoastApi';
import type { PathStepMetadata, PathStep } from 'reducers/osrdconf/types';
import { getFeatureFlag } from 'reducers/user/userSelectors';

type PathStepSubFormFieldsProps = {
  pathStep: PathStep;
  isOpValid: boolean;
};

type DomesticOperationalPointReference = Extract<OperationalPointReference, { type: 'domestic' }>;
type UicOperationalPointReference = Extract<OperationalPointReference, { type: 'uic' }>;
type IdOperationalPointReference = Extract<OperationalPointReference, { type: 'id' }>;

const DomesticFields = ({
  pathStep,
  isOpValid,
  operationalPoint,
}: PathStepSubFormFieldsProps & {
  operationalPoint: DomesticOperationalPointReference | undefined;
}) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const defaultCountryCode = operationalPoint?.country_code ?? '';
  const defaultMainCode = operationalPoint?.main_code ?? '';
  const defaultSecondaryCode = operationalPoint?.secondary_code ?? '';
  const [subFormCountryCode, setSubFormCountryCode] = useState<string>(defaultCountryCode);
  const [subFormMainCode, setSubFormMainCode] = useState<string>(defaultMainCode);
  const [subFormSecondaryCode, setSubFormSecondaryCode] = useState<string>(defaultSecondaryCode);

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

const UicFields = ({
  pathStep,
  isOpValid,
  operationalPoint,
}: PathStepSubFormFieldsProps & { operationalPoint: UicOperationalPointReference }) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const defaultUicCode = operationalPoint.uic.toString();
  const defaultSecondaryCode = operationalPoint.secondary_code ?? '';
  const [subFormUicCode, setSubFormUicCode] = useState<string>(defaultUicCode);
  const [subFormSecondaryCode, setSubFormSecondaryCode] = useState<string>(defaultSecondaryCode);

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

const OpIdFields = ({
  pathStep,
  isOpValid,
  operationalPoint,
}: PathStepSubFormFieldsProps & { operationalPoint: IdOperationalPointReference }) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const defaultOpIdCode = operationalPoint.operational_point;
  const [subFormOpIdCode, setSubFormOpIdCode] = useState<string>(defaultOpIdCode);

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

const TrackOffsetFields = ({
  pathStep,
  isOpValid,
  trackOffset,
}: PathStepSubFormFieldsProps & { trackOffset: TrackOffset }) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });

  const defaultOffset = (trackOffset.offset / 1000).toString();
  const defaultTrack = trackOffset.track;
  const [subFormOffset, setSubFormOffset] = useState<string>(defaultOffset);
  const [subFormTrackId, setSubFormTrackId] = useState<string>(defaultTrack);

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

  const defaultName =
    pathStepMetadata?.validity === 'valid' && pathStepMetadata.type === 'opRef'
      ? pathStepMetadata.name
      : '';
  const [subFormName, setSubFormName] = useState<string>(defaultName);

  if (!unrecognizedWaypointsActivated || !isSubFormExpanded) return;

  const specificFields = () => {
    const loc = pathStep.location;
    if (loc?.type === 'track_offset')
      return <TrackOffsetFields pathStep={pathStep} isOpValid={isOpValid} trackOffset={loc} />;
    const op = loc?.operational_point;
    if (op?.type === 'uic')
      return <UicFields pathStep={pathStep} isOpValid={isOpValid} operationalPoint={op} />;
    if (op?.type === 'id')
      return <OpIdFields pathStep={pathStep} isOpValid={isOpValid} operationalPoint={op} />;
    return <DomesticFields pathStep={pathStep} isOpValid={isOpValid} operationalPoint={op} />;
  };

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
        {specificFields()}
      </div>
    </div>
  );
};

export default PathStepSubForm;
