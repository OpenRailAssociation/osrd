import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { View, Text } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import styles from './styles/SimulationReportStyleSheet';
import type { RouteTableRow } from './types';
import { getStopDurationTime, getStopType } from './utils/formatSimulationReportSheet';

type RouteProps = { isStdcm?: boolean; operationalPointList: RouteTableRow[] };

const RouteTable = ({ isStdcm = false, operationalPointList }: RouteProps) => {
  const { t } = useTranslation('stdcm');

  return (
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
          {isStdcm && (
            <View style={styles.consistAndRoute.stopForWidth}>
              <TD>{t('reportSheet.stopTime')}</TD>
            </View>
          )}
          <View style={styles.consistAndRoute.stopTableStartWidth}>
            <TD>{t('reportSheet.startStop')}</TD>
          </View>
          <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
            {isStdcm && <TD>{t('reportSheet.stopType')}</TD>}
          </View>
        </TH>

        {operationalPointList.map((row, index) => (
          <TR key={index + 1} style={styles.consistAndRoute.stopTableTbody}>
            <View style={styles.consistAndRoute.stopTableIndexWidth}>
              <TD style={styles.consistAndRoute.stopTableIndexColumn}>{index + 1}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableOpWidth}>
              <TD style={styles.consistAndRoute.stopTableOpColumn}>{row.name}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableChWidth}>
              <TD style={styles.consistAndRoute.stopTableChColumn}>{row.secondaryCode}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableEndWidth}>
              <TD
                style={
                  row.italic
                    ? styles.consistAndRoute.stopTableItalicColumn
                    : styles.consistAndRoute.stopTableStartColumn
                }
              >
                {row.arrivesAt && (
                  <>
                    {row.arrivesAt}{' '}
                    {row.tolerances && (
                      <View style={styles.consistAndRoute.tolerancesWidth}>
                        <Text style={styles.consistAndRoute.tolerancesText}>
                          {`+${row.tolerances.after.total('minute')}`}
                        </Text>
                        <Text style={styles.consistAndRoute.tolerancesText}>
                          {`-${row.tolerances.before.total('minute')}`}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </TD>
            </View>
            {isStdcm && (
              <View style={styles.consistAndRoute.stopForWidth}>
                <TD style={styles.consistAndRoute.stopForText}>
                  {getStopDurationTime(row.passageStop)}
                </TD>
              </View>
            )}
            <View style={styles.consistAndRoute.stopTableStartWidth}>
              <TD
                style={
                  row.italic
                    ? styles.consistAndRoute.stopTableItalicColumn
                    : styles.consistAndRoute.stopTableStartColumn
                }
              >
                {row.leavesAt && (
                  <>
                    {row.leavesAt}
                    {row.tolerances && (
                      <View style={styles.consistAndRoute.tolerancesWidth}>
                        <Text style={styles.consistAndRoute.tolerancesText}>
                          {`+${row.tolerances.after.total('minute')}`}
                        </Text>
                        <Text style={styles.consistAndRoute.tolerancesText}>
                          {`-${row.tolerances.before.total('minute')}`}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </TD>
            </View>
            {isStdcm && (
              <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
                <TD style={styles.consistAndRoute.stopTableItalicColumn}>
                  {getStopType(row.stopType, t)}
                </TD>
              </View>
            )}
          </TR>
        ))}
      </Table>
    </View>
  );
};

export default RouteTable;
