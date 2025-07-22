import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import { useDateTimeLocale } from 'utils/date';

import styles from './styles/SimulationReportStyleSheet';

const RCInfo = ({ departureTime }: { departureTime: string }) => {
  const { t } = useTranslation('stdcm');
  const dateTimeLocale = useDateTimeLocale();

  return (
    <View style={styles.rcInfo.rcInfo}>
      <View style={styles.rcInfo.rcBox} />
      <View style={styles.rcInfo.rcBox}>
        <View style={styles.rcInfo.stdcmApplication}>
          <Text style={styles.rcInfo.applicationDate}>{t('reportSheet.applicationDate')}</Text>
          <Text style={styles.rcInfo.date}>
            {new Date(departureTime).toLocaleDateString(dateTimeLocale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default RCInfo;
