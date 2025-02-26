import { Page, Document, View, Image, Text } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { SimulationReportSheetScenarioProps } from 'modules/simulationResult/types';
import { formatDateToString } from 'utils/date';

import Consist from './Consist';
import Header from './Header';
import Route from './Route';
import Simulation from './Simulation';
import styles from './style/SimulationReportStyleSheet';

const SimulationReportSheetScenario = ({
  path,
  scenarioData,
  trainData,
  mapCanvas,
  operationalPointsList,
}: SimulationReportSheetScenarioProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);

  const { creationDate } = trainData;
  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <Header {...{ trainData, scenarioData }} />
        <View style={styles.consistAndRoute.consistAndRoute}>
          <Consist {...{ trainData }} />
          <Route {...{ operationalPointsList }} />
        </View>
        <Simulation {...{ trainData, operationalPointsList, path }} />
        {mapCanvas && (
          <View style={styles.map.map} id="simulationMap">
            <Image src={mapCanvas} />
          </View>
        )}
        <View style={styles.footer.creationDate}>
          <Text>{t('formattedDateScenario', formatDateToString(creationDate))} </Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheetScenario;
