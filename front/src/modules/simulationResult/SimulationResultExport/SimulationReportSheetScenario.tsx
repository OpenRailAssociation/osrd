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

        <View style={styles.convoyAndRoute.convoyAndRoute}>
          <View style={styles.convoyAndRoute.convoy}>
            <Text style={styles.convoyAndRoute.convoyTitle}> {t('reportSheet.convoy')}</Text>
            <View style={styles.convoyAndRoute.convoyInfo}>
              <View style={styles.convoyAndRoute.convoyInfoBox1}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>
                  {t('reportSheet.speedLimitByTag')}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>{speedLimitByTag || '-'}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>
                  {t('reportSheet.towedMaterial')}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>-</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>
                  {t('reportSheet.maxSpeed')}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(rollingStock.max_speed * 3.6)} km/h`}
                </Text>
              </View>
              <View style={styles.convoyAndRoute.convoyInfoBox2}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>
                  {t('reportSheet.maxWeight')}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(rollingStock.mass / 1000)} t`}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>
                  {t('reportSheet.referenceEngine')}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {rollingStock.metadata?.reference || '-'}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>
                  {t('reportSheet.maxLength')}
                </Text>
                <Text
                  style={styles.convoyAndRoute.convoyInfoData}
                >{`${rollingStock.length} m`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.convoyAndRoute.route}>
            <Text style={styles.convoyAndRoute.routeTitle}>{t('reportSheet.requestedRoute')}</Text>
            <View style={styles.convoyAndRoute.stopTableContainer}>
              <Table style={styles.convoyAndRoute.stopTable}>
                <TH style={styles.convoyAndRoute.stopTableTH}>
                  <View style={styles.convoyAndRoute.stopTableIndexWidth}>
                    <TD aria-label="line-count" />
                  </View>
                  <View style={styles.convoyAndRoute.stopTableOpWidth}>
                    <TD>{t('reportSheet.operationalPoint')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableChWidth}>
                    <TD>{t('reportSheet.code')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableEndWidth}>
                    <TD>{t('reportSheet.endStop')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableStartWidth}>
                    <TD>{t('reportSheet.startStop')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableStopTypeWidth} />
                </TH>
                {operationalPointsList.map((step, index) => {
                  const isFirstStep = index === 0;
                  const isLastStep = index === operationalPointsList.length - 1;
                  const shouldRenderRow =
                    isFirstStep || step.duration > Duration.zero || isLastStep;
                  if (shouldRenderRow) {
                    renderedIndex += 1;
                    return (
                      <TR key={index} style={styles.convoyAndRoute.stopTableTbody}>
                        <View style={styles.convoyAndRoute.stopTableIndexWidth}>
                          <TD style={styles.convoyAndRoute.stopTableIndexColumn}>
                            {renderedIndex}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableOpWidth}>
                          <TD style={styles.convoyAndRoute.stopTableOpColumn}>
                            {step.name || t('reportSheet.unknown')}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableChWidth}>
                          <TD style={styles.convoyAndRoute.stopTableChColumn}>{step.ch}</TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableEndWidth}>
                          <TD style={styles.convoyAndRoute.stopTableStartColumn}>
                            {isLastStep ? dateToHHMMSS(step.time, { withoutSeconds: true }) : ''}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableStartWidth}>
                          <TD style={styles.convoyAndRoute.stopTableStartColumn}>
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
