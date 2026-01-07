import type { Distribution } from 'common/api/osrdEditoastApi';
import SpeedLimitTagSelector from 'common/SpeedLimitTagSelector';

import ConstraintDistributionSwitch from './ConstraintDistributionSwitch';
import ElectricalProfiles from './ElectricalProfiles';

type Props = {
  selectedSpeedLimitByTag?: string;
  speedLimitTags: string[];
  updateSpeedLimitTag: (newTag: string | null) => void;
  constraintDistribution: Distribution;
};

const SimulationSettings = ({
  selectedSpeedLimitByTag: speedLimitByTag,
  speedLimitTags,
  updateSpeedLimitTag,
  constraintDistribution,
}: Props) => (
  <div className="simulation-settings">
    <div className="first-row">
      <ElectricalProfiles />
      <ConstraintDistributionSwitch constraintDistribution={constraintDistribution} />
    </div>
    <div className="second-row">
      <SpeedLimitTagSelector
        selectedSpeedLimitTag={speedLimitByTag}
        speedLimitTags={speedLimitTags}
        updateSpeedLimitTag={updateSpeedLimitTag}
        showPlaceHolder
      />
    </div>
  </div>
);

export default SimulationSettings;
