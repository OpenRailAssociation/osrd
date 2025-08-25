import { View, Text } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { SimilarTrainWithSecondaryCode } from 'applications/stdcm/types';
import { useDateTimeLocale } from 'utils/date';

import styles from './styles/SimulationReportStyleSheet';

type SimilarTrainsToDuplicateProps = {
  similarTrains: SimilarTrainWithSecondaryCode[];
};
const SimilarTrainsToDuplicate = ({ similarTrains }: SimilarTrainsToDuplicateProps) => {
  const { t } = useTranslation('stdcm');
  const dateTimeLocale = useDateTimeLocale();

  return (
    <View style={styles.similarTrainsToDuplicate.similarTrainsToDuplicate}>
      <Text style={styles.similarTrainsToDuplicate.title}>
        {t('reportSheet.similarTrainsToDuplicate')}
      </Text>

      <View style={styles.similarTrainsToDuplicate.cardsContainer}>
        {similarTrains.map((similarTrain, index) => (
          <View key={`similarTrain-${index}`} style={styles.similarTrainsToDuplicate.card}>
            <View style={styles.similarTrainsToDuplicate.stationRow}>
              <Text>{similarTrain.begin.name ?? t('reportSheet.notFound')}</Text>
              <Text style={styles.similarTrainsToDuplicate.stationCode}>
                {similarTrain.begin.secondary_code ?? '—'}
              </Text>
            </View>

            <View style={styles.similarTrainsToDuplicate.middleRow}>
              <Text style={styles.similarTrainsToDuplicate.trainId}>
                {similarTrain.train_name ?? t('reportSheet.notFound')}
              </Text>
              <Text style={styles.similarTrainsToDuplicate.startDate}>
                {similarTrain.start_time
                  ? similarTrain.start_time?.toLocaleDateString(dateTimeLocale, {
                      dateStyle: 'short',
                    })
                  : '—'}
              </Text>
            </View>

            <View style={styles.similarTrainsToDuplicate.stationRow}>
              <Text>{similarTrain.end.name ?? t('reportSheet.notFound')}</Text>
              <Text style={styles.similarTrainsToDuplicate.stationCode}>
                {similarTrain.end.secondary_code ?? '—'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default SimilarTrainsToDuplicate;
