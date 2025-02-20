import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Page, Text, Image, Document, View } from '@react-pdf/renderer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import i18n from 'i18n';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { dateToHHMMSS, formatDateToString, formatDay } from 'utils/date';
import { Duration } from 'utils/duration';
import { msToKmh } from 'utils/physics';
import { capitalizeFirstLetter } from 'utils/strings';
import { secToMin } from 'utils/timeManipulation';

import styles from './SimulationReportStyleSheet';
import type { SimulationReportSheetProps } from '../../types';
import { getStopDurationTime } from '../../utils/formatSimulationReportSheet';

const getSecondaryCode = ({ location }: StdcmPathStep) => location!.secondary_code;

const getStopType = (step: StdcmPathStep, t: TFunction) => {
  if (!step.isVia) {
    return t('serviceStop');
  }
  return capitalizeFirstLetter(t(`stdcm:trainPath.stopType.${step.stopType}`));
};

const getArrivalTimes = (step: StdcmPathStep, t: TFunction, shouldDisplay: boolean) => {
  if (shouldDisplay && !step.isVia) {
    if (step.arrival && step.arrivalType === 'preciseTime') {
      return dateToHHMMSS(step.arrival, { withoutSeconds: true });
    }
    return t('asap');
  }
  return '';
};

const LogoSTDCM = ({ logoUrl }: { logoUrl?: string }) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet']);
  if (logoUrl) {
    return <Image src={logoUrl} style={styles.header.lmrLogo} />;
  }
  return (
    <>
      <Text style={styles.header.title}>{t('stdcm')}</Text>
      <Text style={styles.header.creation}>{t('stdcmCreation')}</Text>
    </>
  );
};

const SimulationReportSheet = ({
  stdcmLinkedTrains,
  stdcmData,
  consist,
  simulationReportSheetNumber,
  operationalPointsList,
  simulationSheetLogo,
}: SimulationReportSheetProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  let renderedIndex = 0;

  const { rollingStock, speedLimitByTag, departure_time: departureTime, creationDate } = stdcmData;
  const { anteriorTrain, posteriorTrain } = stdcmLinkedTrains;

  const convoyMass = consist?.totalMass ?? rollingStock.mass / 1000;
  const convoyLength = consist?.totalLength ?? rollingStock.length;
  const convoyMaxSpeed = consist?.maxSpeed ?? msToKmh(rollingStock.max_speed);

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <View style={styles.header.alertBanner}>
          <Image src={iconAlert} style={styles.header.alertIcon} />
          <Text style={styles.header.simulationTitle}>{t('simulation')}</Text>
          <Text style={styles.header.message}>{t('warningMessage')}</Text>
        </View>
        <View style={styles.header.numberDateBanner}>
          <View style={styles.header.stdcmTitleBox}>
            <View style={styles.header.stdcm}>
              <LogoSTDCM logoUrl={simulationSheetLogo} />
            </View>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.number}>
              n°
              {simulationReportSheetNumber}
            </Text>
            <Text style={styles.header.creationDate}>
              {t('formattedDate', formatDateToString(creationDate))}
            </Text>
          </View>
          <Image src={logoSNCF} style={styles.header.sncfLogo} />
        </View>

        <View style={styles.rcInfo.rcInfo}>
          <View style={styles.rcInfo.rcBox} />
          <View style={styles.rcInfo.rcBox}>
            <View style={styles.rcInfo.stdcmApplication}>
              <Text style={styles.rcInfo.applicationDate}>{t('applicationDate')}</Text>
              <Text style={styles.rcInfo.date}>{formatDay(departureTime, i18n.language)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.convoyAndRoute.convoyAndRoute}>
          <View style={styles.convoyAndRoute.convoy}>
            <Text style={styles.convoyAndRoute.convoyTitle}> {t('convoy')}</Text>
            <View style={styles.convoyAndRoute.convoyInfo}>
              <View style={styles.convoyAndRoute.convoyInfoBox1}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('speedLimitByTag')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>{speedLimitByTag || '-'}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('towedMaterial')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {consist?.towedRollingStock?.name ?? '-'}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxSpeed')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(convoyMaxSpeed)} km/h`}
                </Text>
              </View>
              <View style={styles.convoyAndRoute.convoyInfoBox2}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxWeight')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(convoyMass)} t`}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('referenceEngine')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>{rollingStock.name}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxLength')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>{`${convoyLength} m`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.convoyAndRoute.route}>
            <Text style={styles.convoyAndRoute.routeTitle}>{t('requestedRoute')}</Text>
            {anteriorTrain && (
              <View style={styles.convoyAndRoute.fromBanner}>
                <View style={styles.convoyAndRoute.fromBox}>
                  <Text style={styles.convoyAndRoute.from}>{t('from')}</Text>
                </View>
                <Text style={styles.convoyAndRoute.fromNumber}>{anteriorTrain.trainName}</Text>
                <Text style={styles.convoyAndRoute.fromScheduled}>
                  {anteriorTrain &&
                    t('scheduledArrival', { date: anteriorTrain.date, time: anteriorTrain.time })}
                </Text>
              </View>
            )}
            <View style={styles.convoyAndRoute.stopTableContainer}>
              <Table style={styles.convoyAndRoute.stopTable}>
                <TH style={styles.convoyAndRoute.stopTableTH}>
                  <View style={styles.convoyAndRoute.stopTableIndexWidth}>
                    <TD aria-label="line-count" />
                  </View>
                  <View style={styles.convoyAndRoute.stopTableOpWidth}>
                    <TD>{t('operationalPoint')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableChWidth}>
                    <TD>{t('code')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableEndWidth}>
                    <TD>{t('endStop')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableEndWidth}>
                    <TD>{t('stopTime')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableStartWidth}>
                    <TD>{t('startStop')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableStopTypeWidth}>
                    <TD>{t('stopType')}</TD>
                  </View>
                </TH>
                {stdcmData.simulationPathSteps.map((step, index) => {
                  renderedIndex += 1;
                  const isFirstStep = index === 0;
                  const isLastStep = index === stdcmData.simulationPathSteps.length - 1;
                  return (
                    <TR key={index} style={styles.convoyAndRoute.stopTableTbody}>
                      <View style={styles.convoyAndRoute.stopTableIndexWidth}>
                        <TD style={styles.convoyAndRoute.stopTableIndexColumn}>{renderedIndex}</TD>
                      </View>
                      <View style={styles.convoyAndRoute.stopTableOpWidth}>
                        <TD style={styles.convoyAndRoute.stopTableOpColumn}>
                          {step.location!.name}
                        </TD>
                      </View>
                      <View style={styles.convoyAndRoute.stopTableChWidth}>
                        <TD style={styles.convoyAndRoute.stopTableChColumn}>
                          {getSecondaryCode(step)}
                        </TD>
                      </View>
                      <View style={styles.convoyAndRoute.stopTableEndWidth}>
                        <TD
                          style={
                            !step.isVia && step.arrivalType === 'preciseTime'
                              ? styles.convoyAndRoute.stopTableStartColumn
                              : styles.convoyAndRoute.stopTableItalicColumn
                          }
                        >
                          <View>
                            <Text>{getArrivalTimes(step, t, isLastStep)}</Text>
                          </View>
                          {isLastStep && !step.isVia && step.arrivalType === 'preciseTime' && (
                            <View style={styles.convoyAndRoute.tolerancesWidth}>
                              <Text style={styles.convoyAndRoute.tolerancesText}>
                                {step.tolerances?.before
                                  ? `+${secToMin(step.tolerances?.before)}`
                                  : ''}
                              </Text>
                              <Text style={styles.convoyAndRoute.tolerancesText}>
                                {step.tolerances?.after
                                  ? `-${secToMin(step.tolerances?.after)}`
                                  : ''}
                              </Text>
                            </View>
                          )}
                        </TD>
                      </View>
                      <View style={styles.convoyAndRoute.stopForWidth}>
                        <TD style={styles.convoyAndRoute.stopForText}>
                          {step.isVia && step.stopFor ? `${step.stopFor} min` : ''}
                        </TD>
                      </View>
                      <View style={styles.convoyAndRoute.stopTableStartWidth}>
                        <TD
                          style={
                            !step.isVia && step.arrivalType === 'preciseTime'
                              ? styles.convoyAndRoute.stopTableStartColumn
                              : styles.convoyAndRoute.stopTableItalicColumn
                          }
                        >
                          <View>
                            <Text>{getArrivalTimes(step, t, isFirstStep)}</Text>
                          </View>
                          {isFirstStep &&
                            !step.isVia &&
                            step.tolerances &&
                            step.arrivalType === 'preciseTime' && (
                              <View style={styles.convoyAndRoute.tolerancesWidth}>
                                <Text style={styles.convoyAndRoute.tolerancesText}>
                                  {`+${secToMin(step.tolerances.before)}`}
                                </Text>
                                <Text style={styles.convoyAndRoute.tolerancesText}>
                                  {`-${secToMin(step.tolerances.after)}`}
                                </Text>
                              </View>
                            )}
                        </TD>
                      </View>
                      <View style={styles.convoyAndRoute.stopTableStopTypeWidth}>
                        <TD style={styles.convoyAndRoute.stopTableItalicColumn}>
                          {getStopType(step, t)}
                        </TD>
                      </View>
                    </TR>
                  );
                })}
              </Table>
            </View>
            {posteriorTrain && (
              <View style={styles.convoyAndRoute.forBanner}>
                <Text style={styles.convoyAndRoute.forScheduled}>
                  {t('scheduledDeparture', {
                    date: posteriorTrain.date,
                    time: posteriorTrain.time,
                  })}
                </Text>
                <Text style={styles.convoyAndRoute.forNumber}>{posteriorTrain.trainName}</Text>
                <View style={styles.convoyAndRoute.forBox}>
                  <Text style={styles.convoyAndRoute.for}>{t('for')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={styles.simulation.simulation}>
          <View style={styles.simulation.simulationContainer}>
            <Text style={styles.simulation.simulationUppercase}>{t('simulation')}</Text>
            <Text style={styles.simulation.simulationLength}>
              {`${Math.round(stdcmData.path.length / 1000000)} km`}
            </Text>
          </View>
          <View style={styles.simulation.tableContainer}>
            <Table style={styles.simulation.table}>
              <TH style={styles.simulation.th}>
                <View style={styles.simulation.indexWidth}>
                  <TD aria-label="line-count" />
                </View>
                <View style={styles.simulation.opWidth}>
                  <TD>{t('operationalPoint')}</TD>
                </View>
                <View style={styles.simulation.chWidth}>
                  <TD>{t('code')}</TD>
                </View>
                <View style={styles.simulation.trackWidth}>
                  <TD>{t('track')}</TD>
                </View>
                <View style={styles.simulation.endWidth}>
                  <TD>{t('endStop')}</TD>
                </View>
                <View style={styles.simulation.passageWidth}>
                  <TD>{t('passageStop')}</TD>
                </View>
                <View style={styles.simulation.startWidth}>
                  <TD>{t('startStop')}</TD>
                </View>
                <View style={styles.simulation.weightWidth}>
                  <TD>{t('weight')}</TD>
                </View>
                <View style={styles.simulation.length}>
                  <TD>{t('length')}</TD>
                </View>
                <View style={styles.simulation.refEngineWidth}>
                  <TD>{t('referenceEngine')}</TD>
                </View>
                <View style={styles.simulation.stopType}>
                  <TD>{t('simulationStopType')}</TD>
                </View>
              </TH>
              {operationalPointsList.map((step, index) => {
                const isFirstStep = index === 0;
                const isLastStep = index === operationalPointsList.length - 1;
                const prevStep = operationalPointsList[index - 1];
                const isViaInSimulationPath = stdcmData.simulationPathSteps
                  .slice(1, -1)
                  .some(
                    (s) =>
                      s.location && s.location.name === step.name && getSecondaryCode(s) === step.ch
                  );
                const isViaWithoutStop = isViaInSimulationPath && step.duration === 0;
                const isNotExtremity = !isFirstStep && !isLastStep;
                const isStepWithDuration = step.duration !== 0 && !isLastStep;
                const tdPassageStopStyle = !isViaWithoutStop
                  ? styles.simulation.td
                  : { ...styles.simulation.td, paddingLeft: '' };
                return (
                  <TR
                    key={index}
                    style={isStepWithDuration ? styles.simulation.blueRow : styles.simulation.tbody}
                  >
                    <TD
                      style={
                        isViaWithoutStop
                          ? styles.simulation.indexColumnPassageStop
                          : styles.simulation.indexColumn
                      }
                    >
                      {index + 1}
                    </TD>
                    <View style={styles.simulation.opWidth}>
                      <TD
                        style={
                          // eslint-disable-next-line no-nested-ternary
                          isViaWithoutStop
                            ? styles.simulation.opColumnPassageStop
                            : isNotExtremity && step.duration !== 0
                              ? styles.simulation.opStop
                              : styles.simulation.td
                        }
                      >
                        {isNotExtremity && !isViaInSimulationPath && step.name === prevStep.name
                          ? '='
                          : step.name || 'Unknown'}
                      </TD>
                    </View>
                    <View style={styles.simulation.chWidth}>
                      <TD
                        style={
                          isViaWithoutStop
                            ? styles.simulation.chColumnPassageStop
                            : styles.simulation.chColumn
                        }
                      >
                        {step.ch}
                      </TD>
                    </View>
                    <View style={styles.simulation.trackWidth}>
                      <TD style={styles.simulation.td}>{step.trackName}</TD>
                    </View>
                    <View style={styles.simulation.endWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isLastStep || step.duration !== 0 ? step.time : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.passageWidth}>
                      <TD
                        style={{
                          // eslint-disable-next-line no-nested-ternary
                          ...(isStepWithDuration
                            ? {
                                width: `${step.duration < 600 && step.duration >= 60 ? 60 : 70}px`,
                                ...styles.simulation.blueStop,
                              }
                            : !isViaWithoutStop
                              ? styles.simulation.stopColumn
                              : { ...styles.simulation.stopColumn, marginLeft: '' }),
                        }}
                      >
                        {
                          // eslint-disable-next-line no-nested-ternary
                          isNotExtremity
                            ? step.duration !== 0
                              ? getStopDurationTime(new Duration({ seconds: step.duration }))
                              : step.time
                            : ''
                        }
                      </TD>
                    </View>
                    <View style={styles.simulation.startWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isFirstStep || step.duration !== 0 ? step.stopEndTime : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.weightWidth}>
                      <TD style={tdPassageStopStyle}>
                        {!isFirstStep ? '=' : `${Math.floor(convoyMass)} t`}
                      </TD>
                    </View>
                    <View style={styles.simulation.length}>
                      <TD style={tdPassageStopStyle}>{!isFirstStep ? '=' : `${convoyLength} m`}</TD>
                    </View>
                    <View style={styles.simulation.refEngineWidth}>
                      <TD style={tdPassageStopStyle}>
                        {!isFirstStep ? '=' : rollingStock.metadata?.reference}
                      </TD>
                    </View>
                    <View style={styles.simulation.stopType}>
                      {(isFirstStep || isLastStep || step.stopType) && (
                        <TD style={tdPassageStopStyle}>
                          {isFirstStep || isLastStep
                            ? t('serviceStop')
                            : capitalizeFirstLetter(t(`stdcm:trainPath.stopType.${step.stopType}`))}
                        </TD>
                      )}
                    </View>
                  </TR>
                );
              })}
            </Table>
          </View>
        </View>
        <View style={styles.footer.warrantyBox}>
          <Text style={styles.footer.warrantyMessage}>{t('withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheet;
