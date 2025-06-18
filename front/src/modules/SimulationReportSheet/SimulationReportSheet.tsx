import { Page, Text, Image, Document, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { formatDateToString } from 'utils/date';

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

  const consistMass = Math.floor(rollingStock.mass / 1000);
  const consistLength = Math.floor(rollingStock.length);
  const consistMaxSpeed = Math.floor(rollingStock.max_speed * 3.6);

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <Header trainName={trainName} scenarioData={scenarioData} />
        <ConsistAndRoute
          speedLimitByTag={speedLimitByTag ?? undefined}
          rollingStock={rollingStock}
          operationalPointsList={operationalPointsList}
          consistMass={consistMass}
          consistLength={consistLength}
          consistMaxSpeed={consistMaxSpeed}
        />
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
