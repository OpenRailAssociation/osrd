import type { Distribution } from 'common/api/osrdEditoastApi';
import SpeedLimitTagSelector from 'common/SpeedLimitTagSelector';

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
      <SpeedLimitTagSelector
        selectedSpeedLimitByTag={speedLimitByTag}
        speedLimitTags={speedLimitTags}
        dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
        showPlaceHolder
      />
    </div>
  </div>
);

export default SimulationSettings;
