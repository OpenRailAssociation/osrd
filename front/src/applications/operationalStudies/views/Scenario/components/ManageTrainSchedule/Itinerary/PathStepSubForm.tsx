import { type RefObject, useRef, useState } from 'react';

import { Input, useOutsideClick } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { OperationalPointReference, TrackOffset } from 'common/api/osrdEditoastApi';
import type { PathStepMetadata, PathStep } from 'reducers/osrdconf/types';
import { getFeatureFlag } from 'reducers/user/userSelectors';
import { toUpper } from 'utils/strings';

import type { OperationalPointSuggestion } from './ComboBoxCustomList/ListElementComponent';
import { isOpRefMetadata } from './utils';

type PathStepSubFormFieldsProps = {
  pathStep: PathStep;
  isOpValid: boolean;
};

export type OnCustomOpCreation = (
  name: string,
  opRef: DomesticOperationalPointReference,
  existingOp: OperationalPointSuggestion | null
) => void;
export type FindExistingOp = (
  countryCode: string,
  mainCode: string
) => Promise<OperationalPointSuggestion | null>;
export type OnSubFormHasErrors = (hasErrors: boolean) => void;

export type DomesticOperationalPointReference = Extract<
  OperationalPointReference,
  { type: 'domestic' }
>;
type UicOperationalPointReference = Extract<OperationalPointReference, { type: 'uic' }>;
type IdOperationalPointReference = Extract<OperationalPointReference, { type: 'id' }>;

const DomesticFields = ({
  pathStep,
  isOpValid,
  operationalPoint,
  name,
  onCustomOpCreation,
  findExistingOp,
  onSubFormHasErrors,
  subFormRef,
}: PathStepSubFormFieldsProps & {
  operationalPoint: DomesticOperationalPointReference | undefined;
  name: string;
  onCustomOpCreation: OnCustomOpCreation;
  findExistingOp: FindExistingOp;
  onSubFormHasErrors: OnSubFormHasErrors;
  subFormRef: RefObject<HTMLDivElement | null>;
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
  const [countryCodeError, setCountryCodeError] = useState<string>();
  const [mainCodeError, setMainCodeError] = useState<string>();
  const [isExistingMainCode, setIsExistingMainCode] = useState(false);

  // this is to check if the user has changed the codes of the current step, if not, we don't want to show an error message (when the step is re used in the itinerary)
  const isStepCurrentOp =
    toUpper(subFormCountryCode) === defaultCountryCode &&
    toUpper(subFormMainCode) === defaultMainCode &&
    toUpper(subFormSecondaryCode) === defaultSecondaryCode;

  const [prevOperationalPoint, setPrevOperationalPoint] = useState(operationalPoint);
  if (operationalPoint !== prevOperationalPoint) {
    setPrevOperationalPoint(operationalPoint);
    if (!isStepCurrentOp) {
      setSubFormCountryCode(defaultCountryCode);
      setSubFormMainCode(defaultMainCode);
      setSubFormSecondaryCode(defaultSecondaryCode);
      setCountryCodeError(undefined);
      setMainCodeError(undefined);
      setIsExistingMainCode(false);
    }
  }

  const validateCustomOp = async () => {
    const countryCode = toUpper(subFormCountryCode);
    const mainCode = toUpper(subFormMainCode);
    const secondaryCode = toUpper(subFormSecondaryCode);
    if (isOpValid) return;

    if (isStepCurrentOp) {
      setCountryCodeError(undefined);
      setMainCodeError(undefined);
      onSubFormHasErrors(false);
      return;
    }

    const hasMissingCode = !countryCode || !mainCode;
    const existingOp = hasMissingCode ? null : await findExistingOp(countryCode, mainCode);
    const existingOpSameSecondaryCode = !!existingOp?.secondaryCodeList.some(
      (sc) => (sc.code ?? '') === secondaryCode
    );

    setCountryCodeError(countryCode ? undefined : t('missingCountryCode'));
    setMainCodeError(
      existingOpSameSecondaryCode ? t('existingOp') : mainCode ? undefined : t('missingPrimaryCode')
    );
    onSubFormHasErrors(hasMissingCode || existingOpSameSecondaryCode);
    if (hasMissingCode || existingOpSameSecondaryCode) return;

    setIsExistingMainCode(!!existingOp && existingOp.name !== name);

    onCustomOpCreation(
      existingOp?.name || name,
      {
        type: 'domestic',
        country_code: countryCode,
        main_code: mainCode,
        secondary_code: secondaryCode || undefined,
      },
      existingOp
    );
  };

  useOutsideClick(subFormRef, validateCustomOp);

  return (
    <div className="path-step-subform-specific-fields path-step-subform-domestic-fields">
      <Input
        id={`path-step-subform-country-code-${pathStep.key}`}
        label={t('countryCode')}
        readOnly={isOpValid}
        small
        required
        value={isOpValid ? defaultCountryCode : subFormCountryCode}
        inputFieldWrapperClassname={countryCodeError ? 'has-error' : undefined}
        onChange={(e) => {
          setSubFormCountryCode(e.target.value);
          setCountryCodeError(undefined);
        }}
        onBlur={() => {
          if (!subFormCountryCode) setCountryCodeError(t('missingCountryCode'));
        }}
      />
      <Input
        id={`path-step-subform-main-code-${pathStep.key}`}
        label={t('primaryCode')}
        readOnly={isOpValid}
        small
        required
        value={isOpValid ? defaultMainCode : subFormMainCode}
        inputFieldWrapperClassname={mainCodeError ? 'has-error' : undefined}
        onChange={(e) => {
          setSubFormMainCode(e.target.value);
          setMainCodeError(undefined);
        }}
        onBlur={() => {
          if (!subFormMainCode) setMainCodeError(t('missingPrimaryCode'));
        }}
      />
      <Input
        id={`path-step-subform-secondary-code-${pathStep.key}`}
        label={t('secondaryCode')}
        readOnly={isOpValid}
        small
        value={isOpValid ? defaultSecondaryCode : subFormSecondaryCode}
        onChange={(e) => setSubFormSecondaryCode(e.target.value)}
      />
      {(countryCodeError || mainCodeError) && (
        <div className="path-step-subform-error-box" data-testid="path-step-subform-error-box">
          {countryCodeError && (
            <p className="path-step-subform-error-message">{countryCodeError}</p>
          )}
          {mainCodeError && <p className="path-step-subform-error-message">{mainCodeError}</p>}
        </div>
      )}
      {isExistingMainCode && (
        <div className="path-step-subform-warning-box" data-testid="path-step-subform-warning-box">
          <p className="path-step-subform-error-message">{t('existingMainCode')}</p>
        </div>
      )}
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
  name: string;
  onNameChange: (name: string) => void;
  onCustomOpCreation: OnCustomOpCreation;
  findExistingOp: FindExistingOp;
  onSubFormHasErrors: OnSubFormHasErrors;
};

const PathStepSubForm = ({
  pathStep,
  pathStepMetadata,
  isSubFormExpanded,
  isOpValid,
  name,
  onNameChange,
  onCustomOpCreation,
  findExistingOp,
  onSubFormHasErrors,
}: PathStepSubFormProps) => {
  const unrecognizedWaypointsActivated = useSelector(getFeatureFlag('unrecognizedWaypoints'));
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });
  const subFormRef = useRef<HTMLDivElement>(null);

  const subFormName = isOpRefMetadata(pathStepMetadata) ? pathStepMetadata.name : name;

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
    return (
      <DomesticFields
        pathStep={pathStep}
        isOpValid={isOpValid}
        operationalPoint={op}
        name={subFormName}
        onCustomOpCreation={onCustomOpCreation}
        findExistingOp={findExistingOp}
        onSubFormHasErrors={onSubFormHasErrors}
        subFormRef={subFormRef}
      />
    );
  };

  return (
    <div className="path-step-subform-wrapper" ref={subFormRef}>
      <div className="path-step-subform-content">
        <Input
          id={`path-step-subform-name-${pathStep.key}`}
          label={t('name')}
          readOnly={isOpValid && pathStep.location?.type !== 'track_offset'}
          small
          value={subFormName}
          onChange={(e) => onNameChange(e.target.value)}
        />
        {specificFields()}
      </div>
    </div>
  );
};

export default PathStepSubForm;
