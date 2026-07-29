import {
  pacedTrain,
  SCENARIO_NAME_PREFIX,
  uniqueTrain,
} from '../../assets/constants/train-header-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';

test.describe(
  'Schedule sheet header - display and edition',
  { tag: ['@op', '@train-header'] },
  () => {
    setupScenarioFixture({
      scenarioNamePrefix: SCENARIO_NAME_PREFIX,
      trains: [uniqueTrain, pacedTrain],
      scope: 'test',
    });
  }
);
