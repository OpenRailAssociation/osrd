import React from 'react';

import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Page, Text, Image, Document, View, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import type { PostStdcmApiResponse, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { formatDay } from 'utils/date';
import { getStopDurationTime, getStopTime } from 'utils/timeManipulation';

import styles from './SimulationReportStyleSheet';
import { formatCreationDate } from '../utils';

type SimulationReportSheetProps = {
  stdcmData: PostStdcmApiResponse;
  rollingStockData: RollingStockWithLiveries;
  number: string;
  mapCanvas?: string;
};

const SimulationReportSheet = ({
  stdcmData,
  rollingStockData,
  number,
  mapCanvas,
}: SimulationReportSheetProps) => {
  const { t } = useTranslation('stdcm-simulation-report-sheet');
  const creationDate = t('formattedDate', formatCreationDate(stdcmData.path.created));

  let renderedIndex = 0;

  // TODO: Add RC information when it becomes avalaible, until that, we use fake ones
  const fakeInformation = {
    rcName: 'Super Fret',
    rcPersonName: 'Jane Smith',
    rcPhoneNumber: '01 23 45 67 89',
    rcMail: 'john.doe@example.com',
    path_number1: 'n°XXXXXX',
    path_number2: 'n°YYYYYY',
  };

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
              <Text style={styles.header.title}>{t('stdcm')}</Text>
              <Text style={styles.header.creation}>{t('stdcmCreation')}</Text>
            </View>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.number}>
              n°
              {number}
            </Text>
            <Text style={styles.header.creationDate}>{creationDate}</Text>
          </View>
          <Image src={logoSNCF} style={styles.header.sncfLogo} />
        </View>

        <View style={styles.rcInfo.rcInfo}>
          <View style={styles.rcInfo.rcBox}>
            <Text style={styles.rcInfo.rcName}>{fakeInformation.rcName}</Text>
            <Text style={styles.rcInfo.rcPersonName}>{fakeInformation.rcPersonName}</Text>
          </View>
          <View style={styles.rcInfo.rcBox}>
            <Text style={styles.rcInfo.rcPhoneNumber}>{fakeInformation.rcPhoneNumber}</Text>
            <Text style={styles.rcInfo.rcMail}>{fakeInformation.rcMail}</Text>
          </View>
          <View style={styles.rcInfo.rcBox}>
            <View style={styles.rcInfo.stdcmApplication}>
              <Text style={styles.rcInfo.applicationDate}>{t('applicationDate')}</Text>
              <Text style={styles.rcInfo.date}>{formatDay()}</Text>
              <Text style={styles.rcInfo.referencePath}>{t('referencePath')}</Text>
              <Text style={styles.rcInfo.pathNumber}>{fakeInformation.path_number1}</Text>
            </View>
          </View>
        </View>
        <View style={styles.convoyAndRoute.convoyAndRoute}>
          <View style={styles.convoyAndRoute.convoy}>
            <Text style={styles.convoyAndRoute.convoyTitle}> {t('convoy')}</Text>
            <View style={styles.convoyAndRoute.convoyInfo}>
              <View style={styles.convoyAndRoute.convoyInfoBox1}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('speedLimitByTag')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {stdcmData.simulation.speed_limit_tags || '-'}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('towedMaterial')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>-</Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxSpeed')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(rollingStockData.max_speed * 3.6)} km/h`}
                </Text>
              </View>
              <View style={styles.convoyAndRoute.convoyInfoBox2}>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxWeight')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {`${Math.floor(rollingStockData.mass / 1000)} t`}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('referenceEngine')}</Text>
                <Text style={styles.convoyAndRoute.convoyInfoData}>
                  {rollingStockData.metadata?.reference || '-'}
                </Text>
                <Text style={styles.convoyAndRoute.convoyInfoTitles}>{t('maxLength')}</Text>
                <Text
                  style={styles.convoyAndRoute.convoyInfoData}
                >{`${rollingStockData.length} m`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.convoyAndRoute.route}>
            <Text style={styles.convoyAndRoute.routeTitle}>{t('requestedRoute')}</Text>
            {/* TODO: Add path number and date from reference path when it becomes avalaible */}
            <View style={styles.convoyAndRoute.fromBanner}>
              <View style={styles.convoyAndRoute.fromBox}>
                <Text style={styles.convoyAndRoute.from}>{t('from')}</Text>
              </View>
              <Text style={styles.convoyAndRoute.fromNumber}>{fakeInformation.path_number1}</Text>
              <Text style={styles.convoyAndRoute.fromScheduled} />
            </View>
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
                  <View style={styles.convoyAndRoute.stopTableMotifWidth}>
                    <TD>{t('motif')}</TD>
                  </View>
                </TH>
                {stdcmData.simulation.base.stops.map((step, index) => {
                  const isFirstStep = index === 0;
                  const isLastStep = index === stdcmData.simulation.base.stops.length - 1;
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
                          <TD style={styles.convoyAndRoute.stopTableItalicColumn}>
                            {isLastStep ? t('asap') : ''}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableStartWidth}>
                          <TD style={styles.convoyAndRoute.stopTableStartColumn}>
                            {isFirstStep ? getStopTime(step.time) : ''}
                          </TD>
                        </View>
                        <View style={styles.convoyAndRoute.stopTableMotifWidth}>
                          <TD style={styles.convoyAndRoute.stopTableItalicColumn}>
                            {isFirstStep || isLastStep ? t('serviceStop') : ''}
                          </TD>
                        </View>
                      </TR>
                    );
                  }
                  return null;
                })}
              </Table>
            </View>
            {/* TODO: Add path number and date from reference path when it becomes avalaible */}
            <View style={styles.convoyAndRoute.forBanner}>
              <Text style={styles.convoyAndRoute.forScheduled} />
              <Text style={styles.convoyAndRoute.forNumber}>{fakeInformation.path_number2}</Text>
              <View style={styles.convoyAndRoute.forBox}>
                <Text style={styles.convoyAndRoute.for}>{t('for')}</Text>
              </View>
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
              {`${Math.round(stdcmData.path.length / 1000)} km`}
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
              {stdcmData.simulation.base.stops.map((step, index) => {
                const isFirstStep = index === 0;
                const isLastStep = index === stdcmData.simulation.base.stops.length - 1;
                const prevStep = stdcmData.simulation.base.stops[index - 1];
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
                        {!isFirstStep && !isLastStep && step.name === prevStep.name
                          ? '='
                          : step.name || 'Unknown'}
                      </TD>
                    </View>
                    <View style={styles.simulation.chWidth}>
                      <TD style={styles.simulation.chColumn}>{step.ch}</TD>
                    </View>
                    <View style={styles.simulation.trackWidth}>
                      <TD style={styles.simulation.td}>{step.track_name}</TD>
                    </View>
                    <View style={styles.simulation.endWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isLastStep || step.duration !== 0 ? getStopTime(step.time) : ''}
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
                              : getStopTime(step.time)
                            : ''
                        }
                      </TD>
                    </View>
                    <View style={styles.simulation.startWidth}>
                      <TD style={styles.simulation.stopColumn}>
                        {isFirstStep || (step.duration !== 0 && !isLastStep)
                          ? getStopTime(step.time + step.duration)
                          : ''}
                      </TD>
                    </View>
                    <View style={styles.simulation.weightWidth}>
                      <TD style={styles.simulation.td}>
                        {!isFirstStep ? '=' : `${Math.floor(rollingStockData.mass / 1000)} t`}
                      </TD>
                    </View>
                    <View style={styles.simulation.refEngineWidth}>
                      <TD style={styles.simulation.td}>
                        {!isFirstStep ? '=' : rollingStockData.metadata?.reference}
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
        <View style={styles.map.map} id="simulationMap">
          <Image src={mapCanvas} />
        </View>
        <View style={styles.footer.warrantyBox}>
          <Text style={styles.footer.warrantyMessage}>{t('withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheet;
