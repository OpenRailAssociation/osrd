import { useMemo, useState, useRef, useCallback } from 'react';

import { Button, Input, Select, TextArea } from '@osrd-project/ui-core';
import { Download, CheckCircle } from '@osrd-project/ui-icons';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  type StdcmSimulationInputs,
  type StdcmSuccessResponse,
  type SimilarTrainWithSecondaryCode,
  type StdcmResultsOperationalPoint,
} from 'applications/stdcm/types';
import {
  osrdRailwayManagerApi,
  type LoadingGaugeType,
  type PostSendLastMinuteRequestApiArg,
  type SimulationReport,
} from 'common/api/osrdRailwayManagerApi';
import {
  createLinkedTrainPayload,
  createSimilarTrainPayload,
  getStopDurationTime,
  transformStepsToApiFormat,
  validateTolerance,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { setFailure } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { addDurationToDate, Duration, subtractDurationFromDate } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import type { DeploymentSettings } from 'utils/hooks/useDeploymentSettings';
import { kmhToMs, tToKg } from 'utils/physics';

import StdcmSimulationReportSheet from './StdcmSimulationReportSheet';

type SendToRailwayManagerModalProps = {
  onClose: () => void;
  consist: StdcmSimulationInputs['consist'];
  stdcmData: StdcmSuccessResponse;
  linkedTrains: StdcmSimulationInputs['linkedTrains'];
  simulationReportSheetNumber: string;
  operationalPointsList: StdcmResultsOperationalPoint[];
  simulationSheetLogo?: string;
  similarTrains: SimilarTrainWithSecondaryCode[];
  deploymentSettings?: DeploymentSettings;
};

type Option = { value: string; label: string };

const SendToRailwayManagerModal = ({
  consist,
  onClose,
  stdcmData,
  linkedTrains,
  simulationReportSheetNumber,
  operationalPointsList,
  simulationSheetLogo,
  similarTrains,
  deploymentSettings,
}: SendToRailwayManagerModalProps) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const { t: mainT } = useTranslation('translation');
  const dateTimeLocale = useDateTimeLocale();
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const dispatch = useAppDispatch();

  const [pathType, setPathType] = useState<Option>();
  const [comment, setComment] = useState('');
  const [csCode, setCsCode] = useState('');
  const [pathTypeError, setPathTypeError] = useState(false);
  const [csCodeError, setCsCodeError] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);

  const { simulationPathSteps: steps } = stdcmData;

  const firstStep = steps[0] as Extract<StdcmPathStep, { isVia: false }>;
  const lastStep = steps[steps.length - 1] as Extract<StdcmPathStep, { isVia: false }>;
  const intermediatePoints = useMemo(() => steps.slice(1, -1), [steps]);

  const constraintOnDeparture = firstStep.arrivalType === 'preciseTime';
  const realDepartureTime = new Date(stdcmData.departure_time);
  const tripDuration = stdcmData.simulation.final_output.times.at(-1)!;

  const realConstraintTime = constraintOnDeparture
    ? realDepartureTime
    : new Date(realDepartureTime.getTime() + tripDuration);
  const constraintTime = constraintOnDeparture
    ? new Date(firstStep.arrival!)
    : new Date(lastStep.arrival!);
  const diffMinutes = new Duration({
    minutes: Math.round((realConstraintTime.getTime() - constraintTime.getTime()) / 60000),
  });

  const { tolerances } = constraintOnDeparture ? firstStep : lastStep;

  const [beforeTolerance, setBeforeTolerance] = useState<Duration>(
    tolerances.before.add(diffMinutes)
  );
  const [afterTolerance, setAfterTolerance] = useState<Duration>(tolerances.after.sub(diffMinutes));

  const afterDate = addDurationToDate(realConstraintTime, afterTolerance);
  const beforeDate = subtractDurationFromDate(realConstraintTime, beforeTolerance);

  const [sendLastMinuteRequest, { isLoading, isSuccess }] =
    osrdRailwayManagerApi.endpoints.postSendLastMinuteRequest.useMutation();

  const convoyDetails = useMemo(
    () => [
      { label: t('modal.compositionCode'), value: consist?.speedLimitByTag ?? '-' },
      {
        label: t('modal.totalTonnage'),
        value: consist?.totalMass ? `${consist.totalMass} t` : '-',
      },
      { label: t('modal.rollingStock'), value: consist?.towedRollingStock?.name },
      { label: t('modal.referenceEngine'), value: stdcmData.rollingStock.name ?? '-' },
      {
        label: t('modal.maxSpeed'),
        value: consist?.maxSpeed != null ? `${consist.maxSpeed} km/h` : '-',
      },
      {
        label: t('modal.totalLength'),
        value: consist?.totalLength != null ? `${consist.totalLength} m` : '-',
      },
      { label: t('modal.gauge'), value: consist?.loadingGauge ?? '-' },
    ],
    [consist, stdcmData.rollingStock.name, t]
  );

  const pathTypeOptions = [
    { value: 'LongFRET', label: t('modal.LongFRET') },
    { value: 'Autre', label: t('modal.other') },
  ];

  const pdfDocument = useMemo(
    () => (
      <StdcmSimulationReportSheet
        stdcmLinkedTrains={linkedTrains}
        stdcmData={stdcmData}
        consist={consist}
        simulationReportSheetNumber={simulationReportSheetNumber}
        operationalPointsList={operationalPointsList}
        simulationSheetLogo={simulationSheetLogo}
        similarTrains={similarTrains}
      />
    ),
    [
      linkedTrains,
      stdcmData,
      consist,
      simulationReportSheetNumber,
      operationalPointsList,
      simulationSheetLogo,
      similarTrains,
    ]
  );

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

    const instance = pdf(pdfDocument);
    const blobToUpload = await instance.toBlob();

    const filename = `Last Minute Request-${simulationReportSheetNumber}`;

    const formData = new FormData();

    const normalizedDate = new Date(realDepartureTime);
    normalizedDate.setSeconds(0);
    normalizedDate.setMilliseconds(0);

    const similarTrain = createSimilarTrainPayload(similarTrains, dateTimeLocale);
    const linkedTrain = createLinkedTrainPayload(linkedTrains);

    if (
      !consist?.tractionEngine?.name ||
      !consist?.loadingGauge ||
      !consist?.speedLimitByTag ||
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

    const simulationReport: SimulationReport = {
      rolling_stock: consist.tractionEngine.name,
      towed_rolling_stock: consist.towedRollingStock?.name,
      loading_gauge_type: consist.loadingGauge as LoadingGaugeType,
      speed_limit_tags: consist.speedLimitByTag,
      total_mass: tToKg(consist.totalMass),
      max_speed: kmhToMs(consist.maxSpeed),
      total_length: consist.totalLength,
      requested_steps: transformStepsToApiFormat(steps, beforeTolerance, afterTolerance),
      departure_time: normalizedDate.toISOString(),
      user_message: comment,
      similar_train: similarTrain,
      linked_train: linkedTrain,
      course_type: pathType.value,
      statistical_category: csCode,
    };

    formData.append('simulation_report', JSON.stringify(simulationReport));
    formData.append(
      'simulation_report_sheet',
      new File([blobToUpload], filename, { type: 'application/pdf' })
    );

    try {
      await sendLastMinuteRequest({
        body: formData as unknown as PostSendLastMinuteRequestApiArg['body'],
      });
    } catch (error) {
      dispatch(
        setFailure(
          castErrorToFailure(error, {
            name: mainT('common.error'),
            message: t('modal.errorRailwayManager'),
          })
        )
      );
    }
  };

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
            <ul>
              {firstStep && (
                <li>
                  {t('modal.departurePoint', {
                    departureAt: `${firstStep.operationalPoint?.name} ${firstStep.operationalPoint?.secondaryCode}`,
                  })}
                </li>
              )}

              {intermediatePoints.map(
                (step) =>
                  step.isVia && (
                    <li key={step.id}>
                      {t('modal.stop', {
                        minutes: getStopDurationTime(step.stopFor),
                        stopAt: `${step.operationalPoint?.name} ${step.operationalPoint?.secondaryCode}`,
                      })}
                    </li>
                  )
              )}

              {lastStep && (
                <li>
                  {t('modal.arrivalPoint', {
                    arrivalAt: `${lastStep.operationalPoint?.name} ${lastStep.operationalPoint?.secondaryCode}`,
                  })}
                </li>
              )}
            </ul>
          </section>

          <section className="simulation">
            <h3>{t('modal.retainedSimulation')}</h3>

            <div>
              <PDFDownloadLink
                document={pdfDocument}
                fileName={`${deploymentSettings?.stdcmName || 'Stdcm'}-${simulationReportSheetNumber}.pdf`}
              >
                {({ loading, blob, url }) => {
                  if (blob) pdfBlobRef.current = blob;
                  return (
                    <div
                      className="pdf-download"
                      style={{ cursor: loading ? 'wait' : 'pointer' }}
                      onClick={() => {
                        if (!loading && url) window.open(url, '_blank');
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="pdf-icon">
                        <Download />
                      </span>
                      <span className="pdf-badge">{t('modal.pdf')}</span>
                    </div>
                  );
                }}
              </PDFDownloadLink>
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
            <div className={`path-type ${pathTypeError ? 'wiggle' : ''}`}>
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
        </section>
      </div>

      <div className="modal-actions">
        <p>{t('modal.followUpMessage')}</p>
        <div className="actions">
          {isSuccess && (
            <div>
              <span className="success-message">{t('modal.successMessage')}</span>
              <span className="success-icon">
                <CheckCircle variant="fill" />
              </span>
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
