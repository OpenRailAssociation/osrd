import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import i18n from 'i18n';
import { formatDay } from 'utils/date';

import styles from './style/SimulationReportStyleSheet';

interface RcInfoProps {
  stdcmData?: StdcmSuccessResponse;
}

const RcInfo = ({ stdcmData }: RcInfoProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  const departureTime = stdcmData!.departure_time;

  return (
    <View style={styles.rcInfo.rcInfo}>
      <View style={styles.rcInfo.rcBox} />
      <View style={styles.rcInfo.rcBox}>
        <View style={styles.rcInfo.stdcmApplication}>
          <Text style={styles.rcInfo.applicationDate}>{t('applicationDate')}</Text>
          <Text style={styles.rcInfo.date}>{formatDay(departureTime, i18n.language)}</Text>
        </View>
      </View>
    </View>
  );
};

export default RcInfo;
