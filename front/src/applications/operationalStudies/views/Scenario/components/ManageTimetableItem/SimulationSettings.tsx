import type { Distribution } from 'common/api/osrdEditoastApi';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector';

import ConstraintDistributionSwitch from './ConstraintDistributionSwitch';
import ElectricalProfiles from './ElectricalProfiles';

type Props = {
  selectedSpeedLimitByTag?: string;
  speedLimitTags: string[];
  dispatchUpdateSpeedLimitByTag: (newTag: string | null) => void;
  constraintDistribution: Distribution;
};

const SimulationSettings = ({
  selectedSpeedLimitByTag: speedLimitByTag,
  speedLimitTags,
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
        speedLimitTags={speedLimitTags}
        dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
        showPlaceHolder
      />
    </div>
  </div>
);

export default SimulationSettings;
