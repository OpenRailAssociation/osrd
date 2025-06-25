import { Page, Text, Document, View, Image } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type {
  LinkedTrains,
  StdcmResultsOperationalPoint,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import ConsistAndRoute from 'modules/SimulationReportSheet/ConsistAndRoute';
import Header from 'modules/SimulationReportSheet/Header';
import RCInfo from 'modules/SimulationReportSheet/RCInfo';
import SimulationTable from 'modules/SimulationReportSheet/SimulationTable';
import styles from 'modules/SimulationReportSheet/styles/SimulationReportStyleSheet';
import { msToKmh, tToKg } from 'utils/physics';

type StdcmSimulationReportSheetProps = {
  stdcmLinkedTrains: LinkedTrains;
  stdcmData: StdcmSuccessResponse;
  consist: StdcmSimulationInputs['consist'];
  simulationReportSheetNumber: string;
  operationalPointsList: StdcmResultsOperationalPoint[];
  simulationSheetLogo?: string;
};

const StdcmSimulationReportSheet = ({
  stdcmLinkedTrains,
  stdcmData,
  consist,
  simulationReportSheetNumber,
  operationalPointsList,
  simulationSheetLogo,
}: StdcmSimulationReportSheetProps) => {
  const { t } = useTranslation('stdcm');

  const { rollingStock, speedLimitByTag, departure_time: departureTime, creationDate } = stdcmData;

  const consistData = {
    rollingStockName: rollingStock.name,
    mass: consist?.totalMass ?? Math.floor(tToKg(rollingStock.mass)),
    length: consist?.totalLength ?? Math.floor(rollingStock.length),
    maxSpeed: consist?.maxSpeed ?? Math.floor(msToKmh(rollingStock.max_speed)),
    speedLimitByTag,
    loadingGauge: consist?.loadingGauge,
    towedRollingStockName: consist?.towedRollingStock?.name,
  };

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <View style={styles.header.alertBanner}>
          <Image src={iconAlert} style={styles.header.alertIcon} />
          <Text style={styles.header.simulationTitle}>{t('reportSheet.simulation')}</Text>
          <Text style={styles.header.message}>{t('reportSheet.warningMessage')}</Text>
        </View>
        <Header
          simulationReportSheetNumber={simulationReportSheetNumber}
          simulationSheetLogo={simulationSheetLogo}
          creationDate={creationDate}
        />
        <RCInfo departureTime={departureTime} />
        <ConsistAndRoute
          consist={consistData}
          stdcmLinkedTrains={stdcmLinkedTrains}
          stdcmData={stdcmData}
        />
        <SimulationTable
          mode="stdcm"
          stdcmData={stdcmData}
          operationalPointsList={operationalPointsList}
          rollingStock={rollingStock}
          consistMass={consistData.mass}
          consistLength={consistData.length}
        />
        <View style={styles.footer.warrantyBox}>
          <Text style={styles.footer.warrantyMessage}>{t('reportSheet.withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default StdcmSimulationReportSheet;
