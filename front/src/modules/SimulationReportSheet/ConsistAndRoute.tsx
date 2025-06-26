import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { LinkedTrains } from 'applications/stdcm/types';

import Consist from './Consist';
import Route from './Route';
import styles from './styles/SimulationReportStyleSheet';
import type { RouteTableRow } from './types';

type ConsistAndRouteProps = {
  isStdcm?: boolean;
  stdcmLinkedTrains?: LinkedTrains;
  routeTableRows: RouteTableRow[];
  consist: {
    rollingStockName: string;
    mass: number;
    maxSpeed: number;
    length: number;
    speedLimitByTag?: string | null;
    loadingGauge?: string;
    towedRollingStockName?: string;
  };
};

const ConsistAndRoute = ({
  isStdcm = false,
  consist,
  stdcmLinkedTrains,
  routeTableRows,
}: ConsistAndRouteProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <View style={styles.consistAndRoute.consistAndRoute}>
      <Consist {...consist} />
      <View style={styles.consistAndRoute.route}>
        <Text style={styles.consistAndRoute.routeTitle}>{t('reportSheet.requestedRoute')}</Text>

        {stdcmLinkedTrains?.anteriorTrain && (
          <View style={styles.consistAndRoute.fromBanner}>
            <View style={styles.consistAndRoute.fromBox}>
              <Text style={styles.consistAndRoute.from}>{t('reportSheet.from')}</Text>
            </View>
            <Text style={styles.consistAndRoute.fromNumber}>
              {stdcmLinkedTrains.anteriorTrain.trainName}
            </Text>
            <Text style={styles.consistAndRoute.fromScheduled}>
              {t('reportSheet.scheduledArrival', {
                date: stdcmLinkedTrains.anteriorTrain.date,
                time: stdcmLinkedTrains.anteriorTrain.time,
              })}
            </Text>
          </View>
        )}

        <Route isStdcm={isStdcm} operationalPointList={routeTableRows} />

        {stdcmLinkedTrains?.posteriorTrain && (
          <View style={styles.consistAndRoute.forBanner}>
            <Text style={styles.consistAndRoute.forScheduled}>
              {t('reportSheet.scheduledDeparture', {
                date: stdcmLinkedTrains.posteriorTrain.date,
                time: stdcmLinkedTrains.posteriorTrain.time,
              })}
            </Text>
            <Text style={styles.consistAndRoute.forNumber}>
              {stdcmLinkedTrains.posteriorTrain.trainName}
            </Text>
            <View style={styles.consistAndRoute.forBox}>
              <Text style={styles.consistAndRoute.for}>{t('reportSheet.for')}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default ConsistAndRoute;
