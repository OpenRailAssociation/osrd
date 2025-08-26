import type { Distribution } from 'common/api/osrdEditoastApi';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector';

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
  <div className="simulation-settings">
    <div className="first-row">
      <ElectricalProfiles />
      <ConstraintDistributionSwitch constraintDistribution={constraintDistribution} />
    </div>
    <div className="second-row">
      <SpeedLimitByTagSelector
        selectedSpeedLimitByTag={speedLimitByTag}
        speedLimitsByTags={speedLimitsByTags}
        dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
        showPlaceHolder
      />
    </div>
  </div>
);

export default SimulationSettings;
