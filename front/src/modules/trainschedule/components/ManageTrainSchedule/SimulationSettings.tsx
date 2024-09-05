import type { Distribution } from 'common/api/osrdEditoastApi';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';

import ConstraintDistributionSwitch from './ConstraintDistributionSwitch';
import ElectricalProfiles from './ElectricalProfiles';

type Props = {
  selectedSpeedLimitByTag?: string;
  speedLimitsByTags: string[];
  dispatchUpdateSpeedLimitByTag: (newTag: string | null) => void;
  constraintDistribution: Distribution;
};

const SimulationSettings = ({
  selectedSpeedLimitByTag: speedLimitByTag,
  speedLimitsByTags,
  dispatchUpdateSpeedLimitByTag,
  constraintDistribution,
}: Props) => (
  <div className="row no-gutters">
    <div className="col-lg-6 pr-lg-2">
      <ElectricalProfiles />
      <ConstraintDistributionSwitch constraintDistribution={constraintDistribution} />
      <SpeedLimitByTagSelector
        selectedSpeedLimitByTag={speedLimitByTag}
        speedLimitsByTags={speedLimitsByTags}
        dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
      />
    </div>
  </div>
);

export default SimulationSettings;
