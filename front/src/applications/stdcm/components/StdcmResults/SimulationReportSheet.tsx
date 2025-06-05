import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Page, Text, Image, Document, View } from '@react-pdf/renderer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { dateToHHMMSS, formatDateToString, formatDay } from 'utils/date';
import { Duration } from 'utils/duration';
import { msToKmh } from 'utils/physics';
import { capitalizeFirstLetter } from 'utils/strings';

import styles from './SimulationReportStyleSheet';
import type { SimulationReportSheetProps } from '../../types';
import { getStopDurationTime } from '../../utils/formatSimulationReportSheet';

const getSecondaryCode = ({ location }: StdcmPathStep) => location!.secondary_code;

const getStopType = (step: StdcmPathStep, t: TFunction<'stdcm'>) => {
  if (!step.isVia) {
    return t('reportSheet.serviceStop');
  }
  return capitalizeFirstLetter(t(`trainPath.stopType.${step.stopType}`));
};

const getArrivalTimes = (step: StdcmPathStep, t: TFunction<'stdcm'>, shouldDisplay: boolean) => {
  if (shouldDisplay && !step.isVia) {
    if (step.arrival && step.arrivalType === 'preciseTime') {
      return dateToHHMMSS(step.arrival, { withoutSeconds: true });
    }
    return t('reportSheet.asap');
  }
  return '';
};

const LogoSTDCM = ({ logoUrl }: { logoUrl?: string }) => {
  const { t } = useTranslation('stdcm');
  if (logoUrl) {
    return <Image src={logoUrl} style={styles.header.stdcmLogo} />;
  }
  return (
    <>
      <Text style={styles.header.title}>{t('reportSheet.stdcm')}</Text>
      <Text style={styles.header.creation}>{t('reportSheet.stdcmCreation')}</Text>
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
  const { t, i18n } = useTranslation('stdcm');
  let renderedIndex = 0;

  const { rollingStock, speedLimitByTag, departure_time: departureTime, creationDate } = stdcmData;
  const { anteriorTrain, posteriorTrain } = stdcmLinkedTrains;

  const consistMass = consist?.totalMass ?? rollingStock.mass / 1000;
  const consistLength = consist?.totalLength ?? rollingStock.length;
  const consistMaxSpeed = consist?.maxSpeed ?? msToKmh(rollingStock.max_speed);

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <View style={styles.header.alertBanner}>
          <Image src={iconAlert} style={styles.header.alertIcon} />
          <Text style={styles.header.simulationTitle}>{t('reportSheet.simulation')}</Text>
          <Text style={styles.header.message}>{t('reportSheet.warningMessage')}</Text>
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
              {t('reportSheet.formattedDate', formatDateToString(creationDate))}
            </Text>
          </View>
          <Image src={logoSNCF} style={styles.header.sncfLogo} />
        </View>

        <View style={styles.rcInfo.rcInfo}>
          <View style={styles.rcInfo.rcBox} />
          <View style={styles.rcInfo.rcBox}>
            <View style={styles.rcInfo.stdcmApplication}>
              <Text style={styles.rcInfo.applicationDate}>{t('reportSheet.applicationDate')}</Text>
              <Text style={styles.rcInfo.date}>{formatDay(departureTime, i18n.language)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.consistAndRoute.consistAndRoute}>
          <View style={styles.consistAndRoute.consist}>
            <Text style={styles.consistAndRoute.consistTitle}> {t('reportSheet.consist')}</Text>
            <View style={styles.consistAndRoute.consistInfo}>
              <View style={styles.consistAndRoute.consistInfoBox1}>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.speedLimitByTag')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>{speedLimitByTag || '-'}</Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.towedMaterial')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>
                  {consist?.towedRollingStock?.name ?? '-'}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.maxSpeed')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>
                  {`${Math.floor(consistMaxSpeed)} km/h`}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.loadingGauge')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>{consist?.loadingGauge}</Text>
              </View>
              <View style={styles.consistAndRoute.consistInfoBox2}>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.maxWeight')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>
                  {`${Math.floor(consistMass)} t`}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.referenceEngine')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>{rollingStock.name}</Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.maxLength')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>{`${consistLength} m`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.consistAndRoute.route}>
            <Text style={styles.consistAndRoute.routeTitle}>{t('reportSheet.requestedRoute')}</Text>
            {anteriorTrain && (
              <View style={styles.consistAndRoute.fromBanner}>
                <View style={styles.consistAndRoute.fromBox}>
                  <Text style={styles.consistAndRoute.from}>{t('reportSheet.from')}</Text>
                </View>
                <Text style={styles.consistAndRoute.fromNumber}>{anteriorTrain.trainName}</Text>
                <Text style={styles.consistAndRoute.fromScheduled}>
                  {anteriorTrain &&
                    t('reportSheet.scheduledArrival', {
                      date: anteriorTrain.date,
                      time: anteriorTrain.time,
                    })}
                </Text>
              </View>
            )}
            <View style={styles.consistAndRoute.stopTableContainer}>
              <Table style={styles.consistAndRoute.stopTable}>
                <TH style={styles.consistAndRoute.stopTableTH}>
                  <View style={styles.consistAndRoute.stopTableIndexWidth}>
                    <TD aria-label="line-count" />
                  </View>
                  <View style={styles.consistAndRoute.stopTableOpWidth}>
                    <TD>{t('reportSheet.operationalPoint')}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableChWidth}>
                    <TD>{t('reportSheet.code')}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableEndWidth}>
                    <TD>{t('reportSheet.endStop')}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableEndWidth}>
                    <TD>{t('reportSheet.stopTime')}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableStartWidth}>
                    <TD>{t('reportSheet.startStop')}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
                    <TD>{t('reportSheet.stopType')}</TD>
                  </View>
                </TH>
                {stdcmData.simulationPathSteps.map((step, index) => {
                  renderedIndex += 1;
                  const isFirstStep = index === 0;
                  const isLastStep = index === stdcmData.simulationPathSteps.length - 1;
                  return (
                    <TR key={index} style={styles.consistAndRoute.stopTableTbody}>
                      <View style={styles.consistAndRoute.stopTableIndexWidth}>
                        <TD style={styles.consistAndRoute.stopTableIndexColumn}>{renderedIndex}</TD>
                      </View>
                      <View style={styles.consistAndRoute.stopTableOpWidth}>
                        <TD style={styles.consistAndRoute.stopTableOpColumn}>
                          {step.location!.name}
                        </TD>
                      </View>
                      <View style={styles.consistAndRoute.stopTableChWidth}>
                        <TD style={styles.consistAndRoute.stopTableChColumn}>
                          {getSecondaryCode(step)}
                        </TD>
                      </View>
                      <View style={styles.consistAndRoute.stopTableEndWidth}>
                        <TD
                          style={
                            !step.isVia && step.arrivalType === 'preciseTime'
                              ? styles.consistAndRoute.stopTableStartColumn
                              : styles.consistAndRoute.stopTableItalicColumn
                          }
                        >
                          <View>
                            <Text>{getArrivalTimes(step, t, isLastStep)}</Text>
                          </View>
                          {isLastStep && !step.isVia && step.arrivalType === 'preciseTime' && (
                            <View style={styles.consistAndRoute.tolerancesWidth}>
                              <Text style={styles.consistAndRoute.tolerancesText}>
                                {step.tolerances?.after
                                  ? `+${step.tolerances.after.total('minute')}`
                                  : ''}
                              </Text>
                              <Text style={styles.consistAndRoute.tolerancesText}>
                                {step.tolerances?.before
                                  ? `-${step.tolerances.before.total('minute')}`
                                  : ''}
                              </Text>
                            </View>
                          )}
                        </TD>
                      </View>
                      <View style={styles.consistAndRoute.stopForWidth}>
                        <TD style={styles.consistAndRoute.stopForText}>
                          {step.isVia && step.stopFor ? getStopDurationTime(step.stopFor) : ''}
                        </TD>
                      </View>
                      <View style={styles.consistAndRoute.stopTableStartWidth}>
                        <TD
                          style={
                            !step.isVia && step.arrivalType === 'preciseTime'
                              ? styles.consistAndRoute.stopTableStartColumn
                              : styles.consistAndRoute.stopTableItalicColumn
                          }
                        >
                          <View>
                            <Text>{getArrivalTimes(step, t, isFirstStep)}</Text>
                          </View>
                          {isFirstStep &&
                            !step.isVia &&
                            step.tolerances &&
                            step.arrivalType === 'preciseTime' && (
                              <View style={styles.consistAndRoute.tolerancesWidth}>
                                <Text style={styles.consistAndRoute.tolerancesText}>
                                  {`+${step.tolerances.after.total('minute')}`}
                                </Text>
                                <Text style={styles.consistAndRoute.tolerancesText}>
                                  {`-${step.tolerances.before.total('minute')}`}
                                </Text>
                              </View>
                            )}
                        </TD>
                      </View>
                      <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
                        <TD style={styles.consistAndRoute.stopTableItalicColumn}>
                          {getStopType(step, t)}
                        </TD>
                      </View>
                    </TR>
                  );
                })}
              </Table>
            </View>
            {posteriorTrain && (
              <View style={styles.consistAndRoute.forBanner}>
                <Text style={styles.consistAndRoute.forScheduled}>
                  {t('reportSheet.scheduledDeparture', {
                    date: posteriorTrain.date,
                    time: posteriorTrain.time,
                  })}
                </Text>
                <Text style={styles.consistAndRoute.forNumber}>{posteriorTrain.trainName}</Text>
                <View style={styles.consistAndRoute.forBox}>
                  <Text style={styles.consistAndRoute.for}>{t('reportSheet.for')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={styles.simulation.simulation}>
          <View style={styles.simulation.simulationContainer}>
            <Text style={styles.simulation.simulationUppercase}>{t('reportSheet.simulation')}</Text>
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
                  <TD>{t('reportSheet.operationalPoint')}</TD>
                </View>
                <View style={styles.simulation.chWidth}>
                  <TD>{t('reportSheet.code')}</TD>
                </View>
                <View style={styles.simulation.trackWidth}>
                  <TD>{t('reportSheet.track')}</TD>
                </View>
                <View style={styles.simulation.endWidth}>
                  <TD>{t('reportSheet.endStop')}</TD>
                </View>
                <View style={styles.simulation.passageWidth}>
                  <TD>{t('reportSheet.passageStop')}</TD>
                </View>
                <View style={styles.simulation.startWidth}>
                  <TD>{t('reportSheet.startStop')}</TD>
                </View>
                <View style={styles.simulation.weightWidth}>
                  <TD>{t('reportSheet.weight')}</TD>
                </View>
                <View style={styles.simulation.length}>
                  <TD>{t('reportSheet.length')}</TD>
                </View>
                <View style={styles.simulation.refEngineWidth}>
                  <TD>{t('reportSheet.referenceEngine')}</TD>
                </View>
                <View style={styles.simulation.stopType}>
                  <TD>{t('reportSheet.simulationStopType')}</TD>
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
                const isViaWithoutStop = isViaInSimulationPath && step.duration === null;
                const isNotExtremity = !isFirstStep && !isLastStep;
                const isStepWithDuration = step.duration !== null && !isLastStep;
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
                            : isNotExtremity && step.duration !== null
                              ? styles.simulation.opStop
                              : styles.simulation.td
                        }
                      >
                        {isNotExtremity && !isViaInSimulationPath && step.name === prevStep.name
                          ? '='
                          : step.name || t('reportSheet.unknown')}
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
                        {isLastStep || step.duration !== null ? step.time : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.passageWidth}>
                      <TD
                        style={{
                          // eslint-disable-next-line no-nested-ternary
                          ...(isStepWithDuration
                            ? {
                                width: `${step.duration! < new Duration({ seconds: 600 }) && step.duration! >= new Duration({ seconds: 60 }) ? 60 : 70}px`,
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
                            ? step.duration !== null
                              ? getStopDurationTime(step.duration)
                              : step.time
                            : ''
                        }
                      </TD>
                    </View>
                    <View style={styles.simulation.startWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isFirstStep || step.duration !== null ? step.stopEndTime : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.weightWidth}>
                      <TD style={tdPassageStopStyle}>
                        {!isFirstStep ? '=' : `${Math.floor(consistMass)} t`}
                      </TD>
                    </View>
                    <View style={styles.simulation.length}>
                      <TD style={tdPassageStopStyle}>
                        {!isFirstStep ? '=' : `${consistLength} m`}
                      </TD>
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
                            ? t('reportSheet.serviceStop')
                            : capitalizeFirstLetter(t(`trainPath.stopType.${step.stopType}`))}
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
          <Text style={styles.footer.warrantyMessage}>{t('reportSheet.withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheet;
