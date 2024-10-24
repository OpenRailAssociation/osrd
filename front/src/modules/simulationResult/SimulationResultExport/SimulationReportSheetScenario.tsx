import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Page, Text, Image, Document, View, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import styles from 'applications/stdcm/components/StdcmResults/SimulationReportStyleSheet';
import { getStopDurationTime } from 'applications/stdcm/utils/formatSimulationReportSheet';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { formatDateToString } from 'utils/date';
import { secToHoursString } from 'utils/timeManipulation';

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
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);
  let renderedIndex = 0;

  const { rollingStock, speedLimitByTag, creationDate, trainName } = trainData;
  const { name: scenarioName, infraName } = scenarioData;

  const headerTitle = t('operationalStudies/study:simulationSheet');

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
            <Text style={styles.header.cardContent}>
              {t('operationalStudies/study:scenarioWithTwoPoints')}
              {scenarioName}
            </Text>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.cardContent}>
              {t('operationalStudies/study:infrastructureWithTwoPoints')}
              {infraName}
            </Text>
          </View>
          <Image src={logoSNCF} style={styles.header.sncfLogo} />
        </View>

        <View style={styles.convoyAndRoute.convoyAndRoute}>
          <View style={styles.convoyAndRoute.convoy}>
            <Text style={styles.convoyAndRoute.convoyTitle}> {t('convoy')}</Text>
            <View style={styles.convoyAndRoute.convoyInfo}>
              <View style={styles.convoyAndRoute.convoyInfoBox1}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('speedLimitByTag')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>{speedLimitByTag || '-'}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('towedMaterial')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>-</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxSpeed')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(rollingStock.max_speed * 3.6)} km/h`}
                </Text>
              </View>
              <View style={styles.convoyAndRoute.convoyInfoBox2}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxWeight')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(rollingStock.mass / 1000)} t`}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('referenceEngine')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {rollingStock.metadata?.reference || '-'}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxLength')}</Text>
                <Text
                  style={styles.convoyAndRoute.convoyInfoData}
                >{`${rollingStock.length} m`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.convoyAndRoute.route}>
            <Text style={styles.convoyAndRoute.routeTitle}>{t('requestedRoute')}</Text>
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
                  <View style={styles.convoyAndRoute.stopTableStartWidth}>
                    <TD>{t('startStop')}</TD>
                  </View>
                  <View style={styles.convoyAndRoute.stopTableStopTypeWidth} />
                </TH>
                {operationalPointsList.map((step, index) => {
                  const isFirstStep = index === 0;
                  const isLastStep = index === operationalPointsList.length - 1;
                  const shouldRenderRow = isFirstStep || step.duration > 0 || isLastStep;
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
                            {step.name || 'Unknown'}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableChWidth}>
                          <TD style={styles.convoyAndRoute.stopTableChColumn}>{step.ch}</TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableEndWidth}>
                          <TD style={styles.convoyAndRoute.stopTableStartColumn}>
                            {isLastStep ? secToHoursString(step.time, { withSeconds: true }) : ''}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableStartWidth}>
                          <TD style={styles.convoyAndRoute.stopTableStartColumn}>
                            {isFirstStep ? secToHoursString(step.time, { withSeconds: true }) : ''}
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
            <Text style={styles.simulation.simulationUppercase}>{t('simulation')}</Text>
            <Link
              href="#simulationMap"
              src="#simulationMap"
              style={styles.simulation.viewSimulation}
            >
              {t('viewSimulation')}
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
                <View style={styles.simulation.refEngineWidth}>
                  <TD>{t('referenceEngine')}</TD>
                </View>
                <View style={styles.simulation.convSignWidth}>
                  <TD>{t('conventionalSign')}</TD>
                </View>
                <View style={styles.simulation.crossedATEWidth}>
                  <TD>{t('crossedATE')}</TD>
                </View>
              </TH>
              {operationalPointsList.map((step, index) => {
                const isFirstStep = index === 0;
                const isLastStep = index === operationalPointsList.length - 1;
                const prevStep = operationalPointsList[index - 1];
                const trackName = step.track_name || '-';

                return (
                  <TR
                    key={index}
                    style={
                      step.duration !== 0 && !isLastStep
                        ? styles.simulation.blueRow
                        : styles.simulation.tbody
                    }
                  >
                    <TD style={styles.simulation.indexColumn}>{index + 1}</TD>
                    <View style={styles.simulation.opWidth}>
                      <TD
                        style={
                          !isFirstStep && !isLastStep && step.duration !== 0
                            ? styles.simulation.opStop
                            : styles.simulation.td
                        }
                      >
                        {!isFirstStep &&
                        !isLastStep &&
                        step.name === prevStep.name &&
                        step.duration === 0
                          ? '='
                          : step.name || 'Unknown'}
                      </TD>
                    </View>
                    <View style={styles.simulation.chWidth}>
                      <TD style={styles.simulation.chColumn}>{step.ch}</TD>
                    </View>
                    <View style={styles.simulation.trackWidth}>
                      <TD style={styles.simulation.td}>{trackName}</TD>
                    </View>
                    <View style={styles.simulation.endWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isLastStep || step.duration !== 0
                          ? secToHoursString(step.time, { withSeconds: false })
                          : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.passageWidth}>
                      <TD
                        style={{
                          ...(step.duration !== 0 && !isLastStep
                            ? {
                                width: `${step.duration < 600 && step.duration >= 60 ? 60 : 70}px`,
                                ...styles.simulation.blueStop,
                              }
                            : styles.simulation.stopColumn),
                        }}
                      >
                        {
                          // eslint-disable-next-line no-nested-ternary
                          !isFirstStep && !isLastStep
                            ? step.duration !== 0
                              ? getStopDurationTime(step.duration)
                              : secToHoursString(step.time, { withSeconds: false })
                            : ''
                        }
                      </TD>
                    </View>
                    <View style={styles.simulation.startWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isFirstStep || step.duration !== 0
                          ? secToHoursString(step.time + step.duration, { withSeconds: false })
                          : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.weightWidth}>
                      <TD style={styles.simulation.td}>
                        {!isFirstStep ? '=' : `${Math.floor(rollingStock?.mass / 1000)} t`}
                      </TD>
                    </View>
                    <View style={styles.simulation.refEngineWidth}>
                      <TD style={styles.simulation.td}>
                        {!isFirstStep ? '=' : rollingStock?.metadata?.reference}
                      </TD>
                    </View>
                    <View style={styles.simulation.convSignWidth}>
                      <TD style={styles.simulation.td} aria-label="conventionalSign" />
                    </View>
                    <View style={styles.simulation.crossedATEWidth}>
                      <TD style={styles.simulation.td} aria-label="crossedATE" />
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
          <Text>{t('formattedDateScenario', formatDateToString(creationDate))} </Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheetScenario;
