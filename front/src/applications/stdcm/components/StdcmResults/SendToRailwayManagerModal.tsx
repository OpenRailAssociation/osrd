import { useEffect, useMemo, useState, useCallback } from 'react';

import { Button, Checkbox, DatePicker, Input, Select, TextArea } from '@osrd-project/ui-core';
import { Download, CheckCircle } from '@osrd-project/ui-icons';
import { Trans, useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type {
  StdcmSimulationInputs,
  SimilarTrainWithSecondaryCode,
  StdcmResultsOutput,
  StdcmPathProperties,
} from 'applications/stdcm/types';
import { StdcmStopTypes } from 'applications/stdcm/types';
import type { SimulationResponseSuccess } from 'common/api/osrdEditoastApi';
import {
  osrdRailwayManagerApi,
  type RmiLoadingGaugeType,
  type PostSendLastMinuteRequestApiArg,
  type SimulationReport,
  type SendLastMinuteRequestResponse,
  type SimulatedStep,
} from 'common/api/osrdRailwayManagerApi';
import {
  createSimilarTrainPayload,
  getStopDurationTime,
  transformStepsToApiFormat,
  validateTolerance,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { interpolateValue } from 'modules/simulationResult/helpers/utils';
import { setFailure } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import {
  addDurationToDate,
  Duration,
  minutesBetween,
  subtractDurationFromDate,
} from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import { kmhToMs, tToKg } from 'utils/physics';

type SendToRailwayManagerModalProps = {
  onSuccess: (isSuccessful: boolean, data: SendLastMinuteRequestResponse) => void;
  onClose: () => void;
  consist: StdcmSimulationInputs['consist'];
  stdcmResults: StdcmResultsOutput;
  linkedTrains: StdcmSimulationInputs['linkedTrains'];
  simulationReportSheetNumber: string;
  similarTrains: SimilarTrainWithSecondaryCode[];
  pdfBlob: Blob;
};

type Option = { value: string; label: string };
type SubstituteTrain = {
  trainName: string;
  date: string;
};

export type TimingContext = {
  originArrivalTime: Date;
  destinationArrivalTime?: Date;
  beforeTolerance: Duration;
  afterTolerance: Duration;
};

function simulatedStepsFromPathProperties(
  pathProperties: StdcmPathProperties,
  pathSteps: StdcmPathStep[],
  simulation: SimulationResponseSuccess
): SimulatedStep[] {
  const interp = (position: number): number =>
    Math.trunc(interpolateValue(simulation.final_output, position, 'times'));
  let remainingViaSteps = pathSteps
    .map((ps) =>
      ps.operationalPoint && ps.isVia ? { opId: ps.operationalPoint.id, stopFor: ps.stopFor } : null
    )
    .filter((ps) => ps !== null);
  const result = pathProperties.operational_points.map((op) => {
    const index = remainingViaSteps.findIndex((ps) => ps.opId === op.id);
    let stopFor: number | undefined;
    if (index >= 0) {
      if (index !== 0) {
        console.error(
          'Could not match via path steps to operational points:',
          remainingViaSteps.slice(0, index)
        );
      }
      stopFor = remainingViaSteps[index].stopFor?.ms;
      remainingViaSteps = remainingViaSteps.slice(index + 1);
    }
    return {
      op_id: op.id,
      path_item_time: interp(op.position),
      stop_for: stopFor,
    };
  });
  if (remainingViaSteps.length > 0) {
    console.error('Could not match via path steps to operational points:', remainingViaSteps);
  }
  return result;
}

const SendToRailwayManagerModal = ({
  consist,
  onSuccess,
  onClose,
  stdcmResults,
  linkedTrains,
  simulationReportSheetNumber,
  similarTrains,
  pdfBlob,
}: SendToRailwayManagerModalProps) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const { t: mainT } = useTranslation('translation');
  const dateTimeLocale = useDateTimeLocale();
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const dispatch = useAppDispatch();

  const DEFAULT_TRAIN_CATEGORY = { value: '', label: t('modal.noCategory') };
  const stdcmData = stdcmResults.results;

  const [pathType, setPathType] = useState<Option>();
  const [trainCategory, setTrainCategory] = useState<Option>(DEFAULT_TRAIN_CATEGORY);
  const [comment, setComment] = useState('');
  const [csCode, setCsCode] = useState('');
  const [substituteTrain, setSubstituteTrain] = useState<SubstituteTrain>({
    trainName: '',
    date: stdcmData.departure_time,
  });
  const [isHazardousMaterials, setIsHazardousMaterials] = useState(false);
  const [pathTypeError, setPathTypeError] = useState(false);
  const [csCodeError, setCsCodeError] = useState(false);

  const { simulationPathSteps: steps } = stdcmData;

  const firstStep = steps[0] as Extract<StdcmPathStep, { isVia: false }>;
  const lastStep = steps[steps.length - 1] as Extract<StdcmPathStep, { isVia: false }>;
  const intermediatePoints = useMemo(() => steps.slice(1, -1), [steps]);

  const constraintOnDeparture = firstStep.arrivalType === 'preciseTime';
  const realDepartureTime = new Date(stdcmData.departure_time);
  const tripDuration = stdcmData.simulation.final_output.times.at(-1)!;
  const selectableSlot = useMemo(() => {
    const dateBeforeDepartureTime = new Date(realDepartureTime);
    dateBeforeDepartureTime.setDate(dateBeforeDepartureTime.getDate() - 1);
    const dateAfterDepartureTime = new Date(realDepartureTime);
    dateAfterDepartureTime.setDate(dateAfterDepartureTime.getDate() + 1);
    return {
      start: dateBeforeDepartureTime,
      end: dateAfterDepartureTime,
    };
  }, [realDepartureTime]);

  const realConstraintTime = constraintOnDeparture
    ? realDepartureTime
    : new Date(realDepartureTime.getTime() + tripDuration);
  const constraintTime = constraintOnDeparture
    ? new Date(firstStep.arrival!)
    : new Date(lastStep.arrival!);

  const diffMinutes = minutesBetween(realConstraintTime, constraintTime);

  const { tolerances } = constraintOnDeparture ? firstStep : lastStep;

  const [beforeTolerance, setBeforeTolerance] = useState<Duration>(
    tolerances.before.add(diffMinutes)
  );
  const [afterTolerance, setAfterTolerance] = useState<Duration>(tolerances.after.sub(diffMinutes));

  const afterDate = addDurationToDate(realConstraintTime, afterTolerance);
  const beforeDate = subtractDurationFromDate(realConstraintTime, beforeTolerance);

  const [
    sendLastMinuteRequest,
    { isLoading, isSuccess, data: sendLMRResponse, error: lastMinuteRequestError },
  ] = osrdRailwayManagerApi.endpoints.postSendLastMinuteRequest.useMutation();

  const convoyDetails = useMemo(
    () => [
      {
        label: t('modal.compositionCode'),
        value: consist.speedLimitByTag ?? '-',
      },
      {
        label: t('modal.totalTonnage'),
        value: consist.totalMass ? `${consist.totalMass} t` : '-',
      },
      {
        label: t('modal.rollingStock'),
        value: consist.towedRollingStock?.name,
      },
      {
        label: t('modal.referenceEngine'),
        value: stdcmData.rollingStock.name ?? '-',
      },
      {
        label: t('modal.maxSpeed'),
        value: typeof consist.maxSpeed === 'number' ? `${consist.maxSpeed} km/h` : '-',
      },
      {
        label: t('modal.totalLength'),
        value: typeof consist.totalLength === 'number' ? `${consist.totalLength} m` : '-',
      },
      { label: t('modal.gauge'), value: consist.loadingGauge ?? '-' },
    ],
    [consist, stdcmData.rollingStock.name, t]
  );

  const pathTypeOptions = [
    { value: 'LongFRET', label: t('modal.LongFRET') },
    { value: 'Autre', label: t('modal.other') },
  ];

  const trainCategoryOptions = [
    DEFAULT_TRAIN_CATEGORY,
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
  ];

  const handleCsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.toUpperCase();
    setCsCode(input);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const transformedValue = e.target.value
      .replace(/&/g, 'et') // replace "&" with "et"
      .replace(/</g, '('); // replace "<" with "("

    setComment(transformedValue);
  };

  const handleBeforeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = new Duration({ minutes: Number(e.currentTarget.value) });
    if (!validateTolerance(value)) return;
    setBeforeTolerance(value);
  };

  const handleAfterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = new Duration({ minutes: Number(e.currentTarget.value) });
    if (!validateTolerance(value)) return;
    setAfterTolerance(value);
  };

  const showPathTypeError = useCallback(() => {
    setPathTypeError(true);
    setTimeout(() => setPathTypeError(false), 500);
  }, []);

  const showCsCodeError = useCallback(() => {
    setCsCodeError(true);
    setTimeout(() => setCsCodeError(false), 500);
  }, []);

  const handleCreate = async () => {
    if (!pathType) {
      showPathTypeError();
      return;
    }

    if (!csCode) {
      showCsCodeError();
      return;
    }

    const filename = `Last Minute Request-${simulationReportSheetNumber}`;

    const formData = new FormData();

    const normalizedDate = new Date(realDepartureTime);
    normalizedDate.setSeconds(0);
    normalizedDate.setMilliseconds(0);

    const similarTrain = createSimilarTrainPayload(similarTrains);
    const substitute_train = substituteTrain.trainName
      ? { path_date: substituteTrain.date, name: substituteTrain.trainName }
      : null;

    if (
      !consist.tractionEngine?.name ||
      !consist.loadingGauge ||
      !consist.speedLimitByTag ||
      consist.totalMass === undefined ||
      consist.maxSpeed === undefined ||
      consist.totalLength === undefined ||
      !['GA', 'GB'].includes(consist.loadingGauge)
    ) {
      dispatch(
        setFailure({
          name: mainT('common.error'),
          message: t('modal.errorMissingConsist'),
        })
      );
      return;
    }

    const timingContext: TimingContext = {
      originArrivalTime: realDepartureTime,
      destinationArrivalTime: constraintOnDeparture ? undefined : realConstraintTime,
      beforeTolerance,
      afterTolerance,
    };

    const simulationReport: SimulationReport = {
      rolling_stock: consist.tractionEngine.name,
      towed_rolling_stock: consist.towedRollingStock?.name,
      loading_gauge_type: consist.loadingGauge as RmiLoadingGaugeType,
      speed_limit_tags: consist.speedLimitByTag,
      total_mass: tToKg(consist.totalMass),
      max_speed: kmhToMs(consist.maxSpeed),
      total_length: consist.totalLength,
      simulated_steps: simulatedStepsFromPathProperties(
        stdcmResults.pathProperties,
        stdcmResults.results.simulationPathSteps,
        stdcmData.simulation
      ),
      requested_steps: transformStepsToApiFormat(steps, timingContext),
      departure_time: normalizedDate.toISOString(),
      user_message: comment,
      similar_train: similarTrain,
      course_type: pathType.value,
      statistical_category: csCode,
      demand_category: trainCategory.value || null,
      hazardous_materials: isHazardousMaterials,
      anterior_train_name: linkedTrains.anteriorTrain?.trainName || null,
      posterior_train_name: linkedTrains.posteriorTrain?.trainName || null,
      substitute_train,
    };

    formData.append('simulation_report', JSON.stringify(simulationReport));
    formData.append(
      'simulation_report_sheet',
      new File([pdfBlob], filename, { type: 'application/pdf' })
    );

    try {
      await sendLastMinuteRequest({
        body: formData as unknown as PostSendLastMinuteRequestApiArg['body'],
      });
    } catch (err) {
      console.error('Error sending last minute request:', err);
    }
  };

  useEffect(() => {
    if (lastMinuteRequestError) {
      dispatch(
        setFailure(
          castErrorToFailure(lastMinuteRequestError, {
            name: mainT('common.error'),
            message: t('modal.errorRailwayManager'),
          })
        )
      );
    }
  }, [lastMinuteRequestError]);

  useEffect(() => {
    if (isSuccess) {
      onSuccess(isSuccess, sendLMRResponse);
    }
  }, [isSuccess, sendLMRResponse]);

  return (
    <div className="send-to-railway-manager">
      <h2>{t('modal.newRailManagerRequest')}</h2>
      <div className="modal-contents">
        <p>{t('modal.verifyParameters')}</p>
        <section className="convoy-section">
          <h3>{t('modal.convoy')}</h3>
          <div className="convoy-details">
            {convoyDetails.map((detail, index) => (
              <div key={index} className="detail-item">
                <span>{detail.label}</span>
                <span>{detail.value}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="route-and-simulation">
          <section className="requested-route">
            <h3>{t('modal.requestedRoute')}</h3>
            <ul className="requested-route-content">
              <li>
                {`${t('modal.date')} : ${realDepartureTime.toLocaleDateString(dateTimeLocale, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}`}
              </li>
              {linkedTrains.anteriorTrain && (
                <span className="linked-train-infos">
                  <li>{`${t('modal.from')} : ${linkedTrains.anteriorTrain.trainName}`}</li>
                  <li>{linkedTrains.anteriorTrain.date}</li>
                </span>
              )}

              {firstStep && (
                <li>
                  {t('modal.departurePoint', {
                    departureAt: `${firstStep.operationalPoint?.name} ${firstStep.operationalPoint?.secondaryCode}`,
                  })}
                </li>
              )}

              {intermediatePoints.map((step) => {
                if (!step.isVia) return null;
                const stopType = step.consistChange ? StdcmStopTypes.CONSIST_CHANGE : step.stopType;
                return (
                  <li key={step.id}>
                    {t('modal.stop', {
                      minutes: getStopDurationTime(step.stopFor),
                      stopAt: `${step.operationalPoint?.name} ${step.operationalPoint?.secondaryCode}`,
                      stopType: t(`modal.stopType.${stopType}`),
                    })}
                    {step.consistChange && (
                      <ul className="consist-change">
                        <li>
                          {t('modal.consistChange.rsEngine', {
                            rsEngine: step.consistChange?.rollingStockName,
                          })}
                        </li>
                        <li>
                          {t('modal.consistChange.towedRs', {
                            towedRs: step.consistChange?.towedRollingStockName,
                          })}
                        </li>
                        <li>
                          {t('modal.consistChange.mass', {
                            mass: step.consistChange?.totalMass,
                          })}
                        </li>
                        <li>
                          {t('modal.consistChange.length', {
                            length: step.consistChange?.totalLength,
                          })}
                        </li>
                      </ul>
                    )}
                  </li>
                );
              })}

              {lastStep && (
                <li>
                  {t('modal.arrivalPoint', {
                    arrivalAt: `${lastStep.operationalPoint?.name} ${lastStep.operationalPoint?.secondaryCode}`,
                  })}
                </li>
              )}

              {linkedTrains.posteriorTrain && (
                <span className="linked-train-infos">
                  <li>{`${t('modal.for')} : ${linkedTrains.posteriorTrain.trainName}`}</li>
                  <li>{linkedTrains.posteriorTrain.date}</li>
                </span>
              )}
            </ul>
          </section>

          <section className="simulation">
            <h3>{t('modal.retainedSimulation')}</h3>
            <div>
              <div
                className="pdf-download"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (!pdfBlob) return;
                  const url = URL.createObjectURL(pdfBlob);
                  window.open(url, '_blank');
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
                role="button"
                tabIndex={0}
              >
                <Download className="pdf-icon" size="lg" iconColor="var(--grey40)" />
                <span className="pdf-badge">{t('modal.pdf')}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="time-constraints-section">
          <h3>{constraintOnDeparture ? t('modal.departureTiming') : t('modal.arrivalTiming')}</h3>
          <div className="time-constraints">
            <div className="tolerance-before">
              <Input
                id="tolerance-before"
                type="number"
                value={beforeTolerance.total('minute')}
                onChange={handleBeforeChange}
                label={t('modal.toleranceBefore')}
                leadingContent="-"
              />
              <span>
                {beforeDate.toLocaleTimeString(dateTimeLocale, {
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </span>
            </div>
            <div className="constraint-time">
              <span className="constraint-time-label">
                {constraintOnDeparture ? t('modal.departureTime') : t('modal.arrivalTime')}
              </span>
              <div className="constraint-time-value">
                {realConstraintTime.toLocaleTimeString(dateTimeLocale, {
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </div>
            </div>
            <div className="tolerance-after">
              <Input
                id="tolerance-after"
                type="number"
                value={afterTolerance.total('minute')}
                onChange={handleAfterChange}
                label={t('modal.toleranceAfter')}
                leadingContent="+"
              />
              <span>
                {afterDate.toLocaleTimeString(dateTimeLocale, {
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </span>
            </div>
          </div>
        </section>

        <section className="additional-info">
          <h3>{t('modal.additionalInformation')}</h3>
          <div className="info-fields">
            <div className={`left-side ${pathTypeError ? 'wiggle' : ''}`}>
              <Select
                id="path-type"
                options={pathTypeOptions}
                placeholder={t('modal.selectPathType')}
                onChange={(selectedOption) => setPathType(selectedOption)}
                value={pathType}
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value}
                label={t('modal.pathType')}
                required
                aria-invalid={pathTypeError}
              />
              <Select
                id="train-category"
                options={trainCategoryOptions}
                onChange={(selectedOption) => setTrainCategory(selectedOption!)}
                value={trainCategory}
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value}
                label={t('modal.trainCategory')}
                required
              />
              <div id="hazardous-materials">
                <Checkbox
                  label={t('modal.hazardousMaterials')}
                  checked={isHazardousMaterials}
                  onChange={() => setIsHazardousMaterials(!isHazardousMaterials)}
                />
              </div>
            </div>
            <div className={`cs-code ${csCodeError ? 'wiggle' : ''}`}>
              <Input
                id="cs-code"
                value={csCode}
                onChange={handleCsChange}
                label={t('modal.csCode')}
                required
                maxLength={3}
              />
              <Input
                id="train-to-be-substituted"
                value={substituteTrain?.trainName}
                onChange={(e) =>
                  setSubstituteTrain({
                    ...substituteTrain,
                    trainName: e.target.value,
                  })
                }
                label={t('modal.trainToBeSubstituted')}
              />
              <DatePicker
                inputProps={{
                  id: 'train-to-be-substituted-date',
                  name: 'op-date',
                  narrow: true,
                }}
                selectableSlot={selectableSlot}
                value={new Date(substituteTrain.date)}
                onDateChange={(date) => {
                  if (date) {
                    setSubstituteTrain({
                      ...substituteTrain,
                      date: date.toISOString(),
                    });
                  }
                }}
              />
            </div>
            <div className="comment">
              <TextArea
                id="comment"
                type="textarea"
                value={comment}
                onChange={handleCommentChange}
                placeholder={t('modal.addComment')}
                label={t('modal.comment')}
                maxLength={200}
              />
            </div>
          </div>
          {isHazardousMaterials && (
            <div className="warning-section">
              <div className="warning-message">
                <p>{t('modal.warnings.hazardousMaterialsBold')}</p>
                <p>{t('modal.warnings.hazardousMaterialsNormal')}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="modal-actions">
        <p>{t('modal.followUpMessage')}</p>
        <div className="actions">
          {isSuccess && (
            <div className="success-message">
              <span>
                <Trans
                  components={{
                    requestNumber: sendLMRResponse.created_request_url ? (
                      <a
                        href={sendLMRResponse.created_request_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="request-link"
                      >
                        {sendLMRResponse.request_identifier}
                      </a>
                    ) : (
                      // eslint-disable-next-line react/jsx-no-useless-fragment
                      <>{sendLMRResponse.request_identifier}</>
                    ),
                  }}
                >
                  {t('modal.successMessage')}
                </Trans>
              </span>
              <CheckCircle className="success-icon" variant="fill" />
            </div>
          )}
          <Button
            label={t(isSuccess ? 'modal.close' : 'modal.cancel')}
            variant={isSuccess ? 'Normal' : 'Cancel'}
            onClick={onClose}
          />
          {!isSuccess && (
            <Button
              label={t('modal.createRailManagerRequest')}
              isDisabled={!railwayManagerUrl}
              onClick={handleCreate}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SendToRailwayManagerModal;
