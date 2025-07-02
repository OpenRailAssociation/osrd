import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Link, Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import { mmToKm } from 'utils/physics';

import styles from './styles/SimulationReportStyleSheet';
import type { SimulationTableRow } from './types';

type SimulationTableProps = {
  rows: SimulationTableRow[];
  pathLength: number; // mm
  isStdcm?: boolean;
};

const SimulationTable = ({ rows, pathLength, isStdcm = false }: SimulationTableProps) => {
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
            <TR key={index} style={row.rowStyle}>
              <TD style={row.stylesByColumn.index}>{index + 1}</TD>
              <View style={styles.simulation.opWidth}>
                <TD style={row.stylesByColumn.name}>{row.name}</TD>
              </View>
              <View style={styles.simulation.chWidth}>
                <TD style={row.stylesByColumn.ch}>{row.ch}</TD>
              </View>
              <View style={styles.simulation.trackWidth}>
                <TD style={styles.simulation.td}>{row.trackName}</TD>
              </View>
              <View style={styles.simulation.endWidth}>
                <TD style={styles.simulation.stopColumn}>{String(row.endTime)}</TD>
              </View>
              <View style={styles.simulation.passageWidth}>
                <TD style={row.stylesByColumn.passageStop}>{String(row.passageStop)}</TD>
              </View>
              <View style={styles.simulation.startWidth}>
                <TD style={styles.simulation.stopColumn}>{String(row.startTime)}</TD>
              </View>
              <View style={styles.simulation.weightWidth}>
                <TD style={row.stylesByColumn.others}>{row.weight}</TD>
              </View>
              {isStdcm && (
                <View style={styles.simulation.length}>
                  <TD style={row.stylesByColumn.others}>{row.length}</TD>
                </View>
              )}
              <View style={styles.simulation.refEngineWidth}>
                <TD style={row.stylesByColumn.others}>{row.referenceEngine}</TD>
              </View>
              {isStdcm ? (
                <View style={styles.simulation.stopType}>
                  {(index === 0 || index === rows.length - 1 || row.stopType) && (
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
          ))}
        </Table>
      </View>
    </View>
  );
};

export default SimulationTable;
