import { Fragment } from 'react';

import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Image, Link, Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import iconTurnaround from 'assets/simulationReportSheet/turnaround-16@4x.png';
import { mmToKm } from 'utils/physics';

import styles from './styles/SimulationReportStyleSheet';
import type { SimulationTableRow } from './types';

type SimulationTableProps = {
  rows: SimulationTableRow[];
  pathLength: number; // mm
  isStdcm?: boolean;
  traceId?: string;
};

const SimulationTable = ({
  rows,
  pathLength,
  isStdcm = false,
  traceId = '',
}: SimulationTableProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <View style={styles.simulation.simulation}>
      <View style={styles.simulation.simulationContainer}>
        <Text style={styles.simulation.simulationUppercase}>{t('reportSheet.simulation')}</Text>
        {!isStdcm && (
          <Link href="#simulationMap" src="#simulationMap" style={styles.simulation.viewSimulation}>
            {t('reportSheet.viewSimulation')}
          </Link>
        )}
        <Text
          style={styles.simulation.simulationLength}
        >{`${Math.round(mmToKm(pathLength))} km`}</Text>
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
            {!isStdcm && (
              <View style={styles.simulation.trackWidth}>
                <TD>{t('reportSheet.track')}</TD>
              </View>
            )}
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
            {isStdcm && (
              <View style={styles.simulation.length}>
                <TD>{t('reportSheet.length')}</TD>
              </View>
            )}
            <View style={styles.simulation.refEngineWidth}>
              <TD>{t('reportSheet.referenceEngine')}</TD>
            </View>
            {isStdcm ? (
              <View style={styles.simulation.stopType}>
                <TD>{t('reportSheet.simulationStopType')}</TD>
              </View>
            ) : (
              <>
                <View style={styles.simulation.convSignWidth}>
                  <TD>{t('reportSheet.conventionalSign')}</TD>
                </View>
                <View style={styles.simulation.crossedATEWidth}>
                  <TD>{t('reportSheet.crossedATE')}</TD>
                </View>
              </>
            )}
          </TH>

          {rows.map((row, index) => (
            <Fragment key={index}>
              <TR
                style={
                  row.consistChanges
                    ? [row.rowStyle, styles.simulation.mainRowWithConsistChange]
                    : row.rowStyle
                }
              >
                <TD style={row.stylesByColumn.index}>{index + 1}</TD>
                <View style={styles.simulation.opWidth}>
                  <TD style={row.stylesByColumn.name}>{row.name}</TD>
                </View>
                <View style={styles.simulation.chWidth}>
                  <TD style={row.stylesByColumn.secondaryCode}>{row.secondaryCode}</TD>
                </View>
                {!isStdcm && (
                  <View style={styles.simulation.trackWidth}>
                    <TD style={styles.simulation.td}>{row.trackName}</TD>
                  </View>
                )}
                <View style={styles.simulation.endWidth}>
                  <TD style={styles.simulation.stopColumn}>{String(row.endTime)}</TD>
                </View>
                <View style={styles.simulation.passageWidth}>
                  <View style={styles.simulation.passageStopContainer}>
                    {row.isBackTrack && (
                      <View style={styles.simulation.backtrackIconContainer}>
                        <Image src={iconTurnaround} style={styles.simulation.backtrackIcon} />
                      </View>
                    )}
                    <TD style={row.stylesByColumn.passageStop}>{String(row.passageStop)}</TD>
                  </View>
                </View>
                <View style={styles.simulation.startWidth}>
                  <TD style={styles.simulation.stopColumn}>{String(row.startTime)}</TD>
                </View>
                <View style={styles.simulation.weightWidth}>
                  {row.consistChanges ? (
                    <TD style={row.stylesByColumn.others}>
                      {row.consistChanges.updatedConsist.totalMass}
                    </TD>
                  ) : (
                    <TD style={row.stylesByColumn.others}>{row.weight}</TD>
                  )}
                </View>
                {isStdcm && (
                  <View style={styles.simulation.length}>
                    {row.consistChanges ? (
                      <TD style={row.stylesByColumn.others}>
                        {row.consistChanges.updatedConsist.totalLength}
                      </TD>
                    ) : (
                      <TD style={row.stylesByColumn.others}>{row.length}</TD>
                    )}
                  </View>
                )}
                <View style={styles.simulation.refEngineWidth}>
                  {row.consistChanges ? (
                    <TD style={row.stylesByColumn.others}>
                      {row.consistChanges.updatedConsist.rollingStockName}
                    </TD>
                  ) : (
                    <TD style={row.stylesByColumn.others}>{row.referenceEngine}</TD>
                  )}
                </View>
                {isStdcm ? (
                  <View style={styles.simulation.stopType}>
                    {(index === 0 ||
                      index === rows.length - 1 ||
                      row.stopType ||
                      row.consistChanges) && (
                      <TD style={row.stylesByColumn.others}>{row.stopTypeLabel}</TD>
                    )}
                  </View>
                ) : (
                  <>
                    <View style={styles.simulation.convSignWidth}>
                      <TD style={row.stylesByColumn.others} aria-label="conventionalSign" />
                    </View>
                    <View style={styles.simulation.crossedATEWidth}>
                      <TD style={row.stylesByColumn.others} aria-label="crossedATE" />
                    </View>
                  </>
                )}
              </TR>
              {row.consistChanges && (
                <TR style={[row.rowStyle, styles.simulation.consistChangeRow]}>
                  <View style={styles.simulation.indexWithConsistRow}>
                    <TD /> {/* Empty cell for the index column */}
                  </View>
                  <TD style={{ flex: 1 }}>
                    <Text style={styles.simulation.consistChangeLabel}>
                      {t('consist.consistChange')}
                    </Text>
                    <Text style={styles.simulation.consistChangeData}>
                      {t('reportSheet.weight')} ({row.consistChanges.currentConsist.totalMass}
                      {' → '}
                      {row.consistChanges.updatedConsist.totalMass}), {t('reportSheet.length')} (
                      {row.consistChanges.currentConsist.totalLength}
                      {' → '}
                      {row.consistChanges.updatedConsist.totalLength})
                    </Text>
                  </TD>
                </TR>
              )}
            </Fragment>
          ))}
          {traceId && (
            <TH style={styles.simulation.footer}>
              <View>
                <TD style={styles.simulation.horizontalBar} />
              </View>
              <View>
                <TD style={styles.simulation.traceId}>{traceId}</TD>
              </View>
            </TH>
          )}
        </Table>
      </View>
    </View>
  );
};

export default SimulationTable;
