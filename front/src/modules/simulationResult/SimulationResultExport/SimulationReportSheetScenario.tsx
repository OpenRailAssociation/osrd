import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Page, Text, Image, Document, View, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import styles from 'applications/stdcm/components/StdcmResults/SimulationReportStyleSheet';
import { getStopDurationTime } from 'applications/stdcm/utils/formatSimulationReportSheet';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { formatDateToString, dateToHHMMSS } from 'utils/date';
import { Duration, addDurationToDate } from 'utils/duration';

import type { SimulationSheetData } from './types';

type SimulationReportSheetScenarioProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  trainData: SimulationSheetData;
  mapCanvas?: string;
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
};

const SimulationReportSheetScenario = ({
  path,
  scenarioData,
  trainData,
  mapCanvas,
  operationalPointsList,
}: SimulationReportSheetScenarioProps) => {
  const { t } = useTranslation(['stdcm']);
  let renderedIndex = 0;

  const { rollingStock, speedLimitByTag, creationDate, trainName } = trainData;
  const { name: scenarioName, infraName } = scenarioData;

  const headerTitle = t('simulationSheet');

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <View style={styles.header.numberDateBanner}>
          <View style={styles.header.stdcmTitleBox}>
            <View style={styles.header.stdcm}>
              <Text style={styles.header.title}>{headerTitle}</Text>
            </View>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.cardContent}>{trainName}</Text>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.cardContent}>{`${t('scenario')}: ${scenarioName}`}</Text>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.cardContent}>{`${t('infrastructure')}: ${infraName}`}</Text>
          </View>
          <Image src={logoSNCF} style={styles.header.sncfLogo} />
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
                <Text style={styles.consistAndRoute.consistInfoData}>-</Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.maxSpeed')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>
                  {`${Math.floor(rollingStock.max_speed * 3.6)} km/h`}
                </Text>
              </View>
              <View style={styles.consistAndRoute.consistInfoBox2}>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.maxWeight')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>
                  {`${Math.floor(rollingStock.mass / 1000)} t`}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.referenceEngine')}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoData}>
                  {rollingStock.metadata?.reference || '-'}
                </Text>
                <Text style={styles.consistAndRoute.consistInfoTitles}>
                  {t('reportSheet.maxLength')}
                </Text>
                <Text
                  style={styles.consistAndRoute.consistInfoData}
                >{`${rollingStock.length} m`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.consistAndRoute.route}>
            <Text style={styles.consistAndRoute.routeTitle}>{t('reportSheet.requestedRoute')}</Text>
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
                  <View style={styles.consistAndRoute.stopTableStartWidth}>
                    <TD>{t('reportSheet.startStop')}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableStopTypeWidth} />
                </TH>
                {operationalPointsList.map((step, index) => {
                  const isFirstStep = index === 0;
                  const isLastStep = index === operationalPointsList.length - 1;
                  const shouldRenderRow =
                    isFirstStep || step.duration > Duration.zero || isLastStep;
                  if (shouldRenderRow) {
                    renderedIndex += 1;
                    return (
                      <TR key={index} style={styles.consistAndRoute.stopTableTbody}>
                        <View style={styles.consistAndRoute.stopTableIndexWidth}>
                          <TD style={styles.consistAndRoute.stopTableIndexColumn}>
                            {renderedIndex}
                          </TD>
                        </View>
                        <View style={styles.consistAndRoute.stopTableOpWidth}>
                          <TD style={styles.consistAndRoute.stopTableOpColumn}>
                            {step.name || t('reportSheet.unknown')}
                          </TD>
                        </View>
                        <View style={styles.consistAndRoute.stopTableChWidth}>
                          <TD style={styles.consistAndRoute.stopTableChColumn}>{step.ch}</TD>
                        </View>
                        <View style={styles.consistAndRoute.stopTableEndWidth}>
                          <TD style={styles.consistAndRoute.stopTableStartColumn}>
                            {isLastStep ? dateToHHMMSS(step.time, { withoutSeconds: true }) : ''}
                          </TD>
                        </View>
                        <View style={styles.consistAndRoute.stopTableStartWidth}>
                          <TD style={styles.consistAndRoute.stopTableStartColumn}>
                            {isFirstStep ? dateToHHMMSS(step.time, { withoutSeconds: true }) : ''}
                          </TD>
                        </View>
                      </TR>
                    );
                  }
                  return null;
                })}
              </Table>
            </View>
          </View>
        </View>
        <View style={styles.simulation.simulation}>
          <View style={styles.simulation.simulationContainer}>
            <Text style={styles.simulation.simulationUppercase}>{t('reportSheet.simulation')}</Text>
            <Link
              href="#simulationMap"
              src="#simulationMap"
              style={styles.simulation.viewSimulation}
            >
              {t('reportSheet.viewSimulation')}
            </Link>
            <Text style={styles.simulation.simulationLength}>
              {`${Math.round(path.length / 1000000)} km`}
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
                <View style={styles.simulation.refEngineWidth}>
                  <TD>{t('reportSheet.referenceEngine')}</TD>
                </View>
                <View style={styles.simulation.convSignWidth}>
                  <TD>{t('reportSheet.conventionalSign')}</TD>
                </View>
                <View style={styles.simulation.crossedATEWidth}>
                  <TD>{t('reportSheet.crossedATE')}</TD>
                </View>
              </TH>
              {operationalPointsList.map((step, index) => {
                const isFirstStep = index === 0;
                const isLastStep = index === operationalPointsList.length - 1;
                const isNotExtremity = !isFirstStep && !isLastStep;
                const prevStep = operationalPointsList[index - 1];
                const trackName = step.track_name || '-';
                const isWaypoint = path.path_item_positions
                  .slice(1, -1)
                  .some((pos) => pos / 1000 === step.position);
                const isViaWithoutStop = isWaypoint && step.duration.ms === 0;
                const isStepWithDuration = step.duration.ms !== 0 && !isLastStep;
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
                            : isNotExtremity && step.duration.ms !== 0
                              ? styles.simulation.opStop
                              : styles.simulation.td
                        }
                      >
                        {isNotExtremity && !isWaypoint && step.name === prevStep.name
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
                      <TD style={styles.simulation.td}>{trackName}</TD>
                    </View>
                    <View style={styles.simulation.endWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isLastStep || step.duration.ms !== 0
                          ? dateToHHMMSS(step.time, { withoutSeconds: true })
                          : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.passageWidth}>
                      <TD
                        style={{
                          // eslint-disable-next-line no-nested-ternary
                          ...(isStepWithDuration
                            ? {
                                width: `${step.duration < new Duration({ seconds: 600 }) && step.duration >= new Duration({ seconds: 60 }) ? 60 : 70}px`,
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
                            ? step.duration.ms !== 0
                              ? getStopDurationTime(step.duration)
                              : dateToHHMMSS(step.time, { withoutSeconds: true })
                            : ''
                        }
                      </TD>
                    </View>
                    <View style={styles.simulation.startWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isFirstStep || step.duration.ms !== 0
                          ? dateToHHMMSS(addDurationToDate(step.time, step.duration), {
                              withoutSeconds: true,
                            })
                          : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.weightWidth}>
                      <TD style={tdPassageStopStyle}>
                        {!isFirstStep ? '=' : `${Math.floor(rollingStock?.mass / 1000)} t`}
                      </TD>
                    </View>
                    <View style={styles.simulation.refEngineWidth}>
                      <TD style={tdPassageStopStyle}>
                        {!isFirstStep ? '=' : rollingStock?.metadata?.reference}
                      </TD>
                    </View>
                    <View style={styles.simulation.convSignWidth}>
                      <TD style={tdPassageStopStyle} aria-label="conventionalSign" />
                    </View>
                    <View style={styles.simulation.crossedATEWidth}>
                      <TD style={tdPassageStopStyle} aria-label="crossedATE" />
                    </View>
                  </TR>
                );
              })}
            </Table>
            <View style={styles.simulation.horizontalBar} />
          </View>
        </View>
        {mapCanvas && (
          <View style={styles.map.map} id="simulationMap">
            <Image src={mapCanvas} />
          </View>
        )}
        <View style={styles.footer.creationDate}>
          <Text>{t('reportSheet.formattedDateScenario', formatDateToString(creationDate))} </Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheetScenario;
