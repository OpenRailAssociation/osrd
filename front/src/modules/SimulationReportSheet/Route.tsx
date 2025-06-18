import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { View, Text } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';

import styles from './styles/SimulationReportStyleSheet';
import formatRouteTable from './utils/formatRouteTable';

type RouteProps =
  | { mode: 'stdcm'; stdcmData: StdcmSuccessResponse }
  | { mode: 'operationalStudies'; operationalPointsList: OperationalPointWithTimeAndSpeed[] };

const RouteTable = (props: RouteProps) => {
  const { t } = useTranslation('stdcm');
  const { mode } = props;
  const isStdcm = mode === 'stdcm';

  const rows = formatRouteTable(props);

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

        {rows.map((row) => (
          <TR key={row.index} style={styles.consistAndRoute.stopTableTbody}>
            <View style={styles.consistAndRoute.stopTableIndexWidth}>
              <TD style={styles.consistAndRoute.stopTableIndexColumn}>{row.index}</TD>
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
                {row.arrivesAt}
                {row.tolerances && row.arrivesAt && (
                  <View style={styles.consistAndRoute.tolerancesWidth}>
                    {row.tolerances.map((tolerances, i) => (
                      <Text key={i} style={styles.consistAndRoute.tolerancesText}>
                        {tolerances}
                      </Text>
                    ))}
                  </View>
                )}
              </TD>
            </View>
            {isStdcm && (
              <View style={styles.consistAndRoute.stopForWidth}>
                <TD style={styles.consistAndRoute.stopForText}>{row.passageStop}</TD>
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
                {row.leavesAt}
                {row.tolerances && row.leavesAt && (
                  <View style={styles.consistAndRoute.tolerancesWidth}>
                    {row.tolerances.map((tolerances, i) => (
                      <Text key={i} style={styles.consistAndRoute.tolerancesText}>
                        {tolerances}
                      </Text>
                    ))}
                  </View>
                )}
              </TD>
            </View>
            {isStdcm && (
              <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
                <TD style={styles.consistAndRoute.stopTableItalicColumn}>{row.stopType}</TD>
              </View>
            )}
          </TR>
        ))}
      </Table>
    </View>
  );
};

export default RouteTable;
