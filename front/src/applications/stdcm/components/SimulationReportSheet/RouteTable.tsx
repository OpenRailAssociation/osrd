import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import { secToMin } from 'utils/timeManipulation';

import { getArrivalTimes, getSecondaryCode, getStopType } from './helpers';
import styles from './SimulationReportStyleSheet';

interface RouteTableProps {
  stdcmData: StdcmSuccessResponse;
}

const RouteTable = ({ stdcmData }: RouteTableProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);

  let renderedIndex = 0;

  return (
    <View style={styles.consistAndRoute.stopTableContainer}>
      <Table style={styles.consistAndRoute.stopTable}>
        <TH style={styles.consistAndRoute.stopTableTH}>
          <View style={styles.consistAndRoute.stopTableIndexWidth}>
            <TD aria-label="line-count" />
          </View>
          <View style={styles.consistAndRoute.stopTableOpWidth}>
            <TD>{t('operationalPoint')}</TD>
          </View>
          <View style={styles.consistAndRoute.stopTableChWidth}>
            <TD>{t('code')}</TD>
          </View>
          <View style={styles.consistAndRoute.stopTableEndWidth}>
            <TD>{t('endStop')}</TD>
          </View>
          <View style={styles.consistAndRoute.stopTableEndWidth}>
            <TD>{t('stopTime')}</TD>
          </View>
          <View style={styles.consistAndRoute.stopTableStartWidth}>
            <TD>{t('startStop')}</TD>
          </View>
          <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
            <TD>{t('stopType')}</TD>
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
                <TD style={styles.consistAndRoute.stopTableOpColumn}>{step.location!.name}</TD>
              </View>
              <View style={styles.consistAndRoute.stopTableChWidth}>
                <TD style={styles.consistAndRoute.stopTableChColumn}>{getSecondaryCode(step)}</TD>
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
                        {step.tolerances?.before ? `+${secToMin(step.tolerances?.before)}` : ''}
                      </Text>
                      <Text style={styles.consistAndRoute.tolerancesText}>
                        {step.tolerances?.after ? `-${secToMin(step.tolerances?.after)}` : ''}
                      </Text>
                    </View>
                  )}
                </TD>
              </View>
              <View style={styles.consistAndRoute.stopForWidth}>
                <TD style={styles.consistAndRoute.stopForText}>
                  {step.isVia && step.stopFor ? `${step.stopFor} min` : ''}
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
                          {`+${secToMin(step.tolerances.before)}`}
                        </Text>
                        <Text style={styles.consistAndRoute.tolerancesText}>
                          {`-${secToMin(step.tolerances.after)}`}
                        </Text>
                      </View>
                    )}
                </TD>
              </View>
              <View style={styles.consistAndRoute.stopTableStopTypeWidth}>
                <TD style={styles.consistAndRoute.stopTableItalicColumn}>{getStopType(step, t)}</TD>
              </View>
            </TR>
          );
        })}
      </Table>
    </View>
  );
};

export default RouteTable;
