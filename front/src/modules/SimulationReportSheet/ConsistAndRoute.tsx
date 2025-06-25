import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { LinkedTrains, StdcmSuccessResponse } from 'applications/stdcm/types';

import Consist from './Consist';
import Route from './Route';
import styles from './styles/SimulationReportStyleSheet';

type ConsistAndRouteProps = {
  stdcmLinkedTrains?: LinkedTrains;
  stdcmData?: StdcmSuccessResponse;
  operationalPointsList?: OperationalPointWithTimeAndSpeed[];
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
  consist,
  stdcmLinkedTrains,
  stdcmData,
  operationalPointsList,
}: ConsistAndRouteProps) => {
  const { t } = useTranslation('stdcm');

  const isStdcm = !!stdcmData;

  return (
    <View style={styles.consistAndRoute.consistAndRoute}>
      <Consist {...consist} />
      <View style={styles.consistAndRoute.route}>
        <Text style={styles.consistAndRoute.routeTitle}>{t('reportSheet.requestedRoute')}</Text>

        {isStdcm && stdcmLinkedTrains && (
          <>
            {stdcmLinkedTrains.anteriorTrain && (
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

            <Route mode="stdcm" stdcmData={stdcmData} />

            {stdcmLinkedTrains.posteriorTrain && (
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
          </>
        )}

        {!isStdcm && operationalPointsList && (
          <Route mode="operationalStudies" operationalPointsList={operationalPointsList} />
        )}
      </View>
    </View>
  );
};

export default ConsistAndRoute;
