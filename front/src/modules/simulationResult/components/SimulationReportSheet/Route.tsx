import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type {
  LinkedTrains,
  StdcmResultsOperationalPoint,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import { secToHoursString } from 'utils/timeManipulation';

import RouteTable from './RouteTable';
import styles from './style/SimulationReportStyleSheet';

interface RouteProps {
  operationalPointsList?: OperationalPointWithTimeAndSpeed[] | StdcmResultsOperationalPoint[];
  stdcmData?: StdcmSuccessResponse;
  stdcmLinkedTrains?: LinkedTrains;
}

const Route = ({ operationalPointsList, stdcmData, stdcmLinkedTrains }: RouteProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  const { anteriorTrain, posteriorTrain } = stdcmLinkedTrains || {};

  return (
    <View style={styles.consistAndRoute.route}>
      <Text style={styles.consistAndRoute.routeTitle}>{t('requestedRoute')}</Text>
      {anteriorTrain && (
        <View style={styles.consistAndRoute.fromBanner}>
          <View style={styles.consistAndRoute.fromBox}>
            <Text style={styles.consistAndRoute.from}>{t('from')}</Text>
          </View>
          <Text style={styles.consistAndRoute.fromNumber}>{anteriorTrain.trainName}</Text>
          <Text style={styles.consistAndRoute.fromScheduled}>
            {t('scheduledArrival', { date: anteriorTrain.date, time: anteriorTrain.time })}
          </Text>
        </View>
      )}

      {operationalPointsList && (
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
              <View style={styles.consistAndRoute.stopTableStartWidth}>
                <TD>{t('startStop')}</TD>
              </View>
            </TH>
            {operationalPointsList.map((step, index) => {
              const isFirstStep = index === 0;
              const isLastStep = index === operationalPointsList.length - 1;
              const shouldRenderRow =
                isFirstStep ||
                (typeof step.duration === 'number' && step.duration > 0) ||
                isLastStep;
              if (shouldRenderRow) {
                return (
                  <TR key={index} style={styles.consistAndRoute.stopTableTbody}>
                    <View style={styles.consistAndRoute.stopTableIndexWidth}>
                      <TD style={styles.consistAndRoute.stopTableIndexColumn}>{index + 1}</TD>
                    </View>
                    <View style={styles.consistAndRoute.stopTableOpWidth}>
                      <TD style={styles.consistAndRoute.stopTableOpColumn}>
                        {step.name || 'Unknown'}
                      </TD>
                    </View>
                    <View style={styles.consistAndRoute.stopTableChWidth}>
                      <TD style={styles.consistAndRoute.stopTableChColumn}>{step.ch}</TD>
                    </View>
                    <View style={styles.consistAndRoute.stopTableEndWidth}>
                      <TD style={styles.consistAndRoute.stopTableStartColumn}>
                        {isLastStep ? secToHoursString(Number(step.time)) : ''}
                      </TD>
                    </View>
                    <View style={styles.consistAndRoute.stopTableStartWidth}>
                      <TD style={styles.consistAndRoute.stopTableStartColumn}>
                        {isFirstStep ? secToHoursString(Number(step.time)) : ''}
                      </TD>
                    </View>
                  </TR>
                );
              }
              return null;
            })}
          </Table>
        </View>
      )}

      {stdcmData && <RouteTable stdcmData={stdcmData} />}

      {posteriorTrain && (
        <View style={styles.consistAndRoute.forBanner}>
          <Text style={styles.consistAndRoute.forScheduled}>
            {t('scheduledDeparture', { date: posteriorTrain.date, time: posteriorTrain.time })}
          </Text>
          <Text style={styles.consistAndRoute.forNumber}>{posteriorTrain.trainName}</Text>
          <View style={styles.consistAndRoute.forBox}>
            <Text style={styles.consistAndRoute.for}>{t('for')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default Route;
