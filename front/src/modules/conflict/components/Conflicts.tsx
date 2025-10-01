import ConflictCard from './ConflictCard';
import ConflictsToolbar from './ConflictsToolbar';
import type { ConflictWithTrainNames } from '../types';

type ConflictsProps = {
  showOnlySelectedTrain: boolean;
  onToggleFilter: () => void;
  selectedTrainName: string | null;
  conflictsCount: number;
  displayedConflicts: ConflictWithTrainNames[];
};

const Conflicts = ({
  showOnlySelectedTrain,
  onToggleFilter,
  selectedTrainName,
  conflictsCount,
  displayedConflicts,
}: ConflictsProps) => (
  <div className="scenario-conflicts">
    <div className="scenario-conflicts-content">
      {selectedTrainName && (
        <ConflictsToolbar
          isFilterActive={showOnlySelectedTrain}
          onToggleFilter={onToggleFilter}
          selectedTrainName={selectedTrainName}
          conflictsCount={conflictsCount}
          disabled={!selectedTrainName}
        />
      )}
      <div className="conflicts-container">
        {displayedConflicts.map((conflict, index) => (
          <ConflictCard key={index} conflict={conflict} />
        ))}
      </div>
    </div>
  </div>
);

export default Conflicts;
