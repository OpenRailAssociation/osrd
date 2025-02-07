import { Page, Document, Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import { msToKmh } from 'utils/physics';

import Consist from './Consist';
import Header from './Header';
import RcInfo from './RcInfo';
import Route from './Route';
import Simulation from './Simulation';
import styles from './SimulationReportStyleSheet';
import type { SimulationReportSheetProps } from '../../types';

const SimulationReportSheet = ({
  stdcmLinkedTrains,
  stdcmData,
  consist,
  simulationReportSheetNumber,
  operationalPointsList,
}: SimulationReportSheetProps) => {
  const { rollingStock } = stdcmData;

  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);

  const consistMass = consist?.totalMass ?? rollingStock.mass / 1000;
  const consistLength = consist?.totalLength ?? rollingStock.length;
  const consistMaxSpeed = consist?.maxSpeed ?? msToKmh(rollingStock.max_speed);

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <Header {...{ simulationReportSheetNumber, stdcmData }} />
        <RcInfo {...{ stdcmData }} />
        <View style={styles.consistAndRoute.consistAndRoute}>
          <Consist {...{ stdcmData, consist, consistMass, consistLength, consistMaxSpeed }} />
          <Route {...{ stdcmLinkedTrains, stdcmData }} />
        </View>
        <Simulation {...{ stdcmData, operationalPointsList, consistMass, consistLength }} />
        <View style={styles.footer.warrantyBox}>
          <Text style={styles.footer.warrantyMessage}>{t('withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheet;
