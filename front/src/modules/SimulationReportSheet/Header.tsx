import { Text, Image, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import logoSNCF from 'assets/simulationReportSheet/logo_sncf_reseau.png';
import StdcmLogo from 'modules/SimulationReportSheet/StdcmLogo';
import { useDateTimeLocale } from 'utils/date';

import styles from './styles/SimulationReportStyleSheet';

type HeaderProps = {
  simulationReportSheetNumber?: string;
  simulationSheetLogo?: string;
  creationDate?: Date;
  trainName?: string;
  scenarioData?: { name: string; infraName: string };
};

const Header = ({
  simulationReportSheetNumber,
  simulationSheetLogo,
  creationDate,
  trainName,
  scenarioData,
}: HeaderProps) => {
  const { t } = useTranslation('stdcm');
  const dateTimeLocale = useDateTimeLocale();

  const title = simulationReportSheetNumber ? (
    <StdcmLogo logoUrl={simulationSheetLogo} />
  ) : (
    <Text style={styles.header.title}>{t('simulationSheet')}</Text>
  );

  return (
    <View style={styles.header.numberDateBanner}>
      <View style={styles.header.stdcmTitleBox}>
        <View style={styles.header.stdcm}>{title}</View>
      </View>

      <View style={styles.header.numericInfo}>
        {simulationReportSheetNumber && (
          <Text style={styles.header.number}>n°{simulationReportSheetNumber}</Text>
        )}

        {creationDate && (
          <Text style={styles.header.creationDate}>
            {t('reportSheet.formattedDate', {
              date: creationDate.toLocaleString(dateTimeLocale, { dateStyle: 'short' }),
              time: creationDate.toLocaleString(dateTimeLocale, { timeStyle: 'short' }),
            })}
          </Text>
        )}

        {trainName && <Text style={styles.header.cardContent}>{trainName}</Text>}
      </View>

      {scenarioData && (
        <>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.cardContent}>
              {`${t('scenario')}: ${scenarioData.name}`}
            </Text>
          </View>
          <View style={styles.header.numericInfo}>
            <Text style={styles.header.cardContent}>
              {`${t('infrastructure')}: ${scenarioData.infraName}`}
            </Text>
          </View>
        </>
      )}

      <Image src={logoSNCF} style={styles.header.sncfLogo} />
    </View>
  );
};

export default Header;
