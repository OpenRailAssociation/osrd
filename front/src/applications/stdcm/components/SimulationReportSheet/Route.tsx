import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { LinkedTrains, StdcmSuccessResponse } from 'applications/stdcm/types';

import RouteTable from './RouteTable';
import styles from './SimulationReportStyleSheet';

interface RouteProps {
  stdcmData: StdcmSuccessResponse;
  stdcmLinkedTrains: LinkedTrains;
}

const Route = ({ stdcmLinkedTrains, stdcmData }: RouteProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  const { anteriorTrain, posteriorTrain } = stdcmLinkedTrains;

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
            {anteriorTrain &&
              t('scheduledArrival', { date: anteriorTrain.date, time: anteriorTrain.time })}
          </Text>
        </View>
      )}
      <RouteTable stdcmData={stdcmData} />
      {posteriorTrain && (
        <View style={styles.consistAndRoute.forBanner}>
          <Text style={styles.consistAndRoute.forScheduled}>
            {t('scheduledDeparture', {
              date: posteriorTrain.date,
              time: posteriorTrain.time,
            })}
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
