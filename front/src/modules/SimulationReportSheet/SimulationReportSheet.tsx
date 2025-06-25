import { Page, Text, Image, Document, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { formatDateToString } from 'utils/date';
import { msToKmh, tToKg } from 'utils/physics';

import ConsistAndRoute from './ConsistAndRoute';
import Header from './Header';
import SimulationTable from './SimulationTable';
import styles from './styles/SimulationReportStyleSheet';
import type { SimulationSheetData } from './types';

type SimulationReportSheetProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  trainData: SimulationSheetData;
  mapCanvas?: string;
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
};

const SimulationReportSheet = ({
  path,
  scenarioData,
  trainData,
  mapCanvas,
  operationalPointsList,
}: SimulationReportSheetProps) => {
  const { t } = useTranslation(['stdcm']);

  const { rollingStock, speedLimitByTag, creationDate, trainName } = trainData;

  const consistData = {
    rollingStockName: rollingStock.name,
    mass: Math.floor(tToKg(rollingStock.mass)),
    length: Math.floor(rollingStock.length),
    maxSpeed: Math.floor(msToKmh(rollingStock.max_speed)),
    speedLimitByTag,
  };

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <Header trainName={trainName} scenarioData={scenarioData} />
        <ConsistAndRoute consist={consistData} operationalPointsList={operationalPointsList} />
        <SimulationTable
          mode="operationalStudies"
          path={path}
          operationalPointsList={operationalPointsList}
          rollingStock={rollingStock}
        />
        {mapCanvas && (
          <View style={styles.map.map} id="simulationMap">
            <Image src={mapCanvas} />
          </View>
        )}
        <View style={styles.footer.creationDate}>
          <Text>{t('reportSheet.formattedDateScenario', formatDateToString(creationDate))} </Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheet;
