import React from 'react';
import { SearchSignalResult } from 'common/api/osrdEditoastApi';

type SignalCardProps = {
  signalSearchResult: SearchSignalResult;
  onResultClick: (results: SearchSignalResult) => void;
};
const SignalCard = ({ signalSearchResult, onResultClick }: SignalCardProps) => (
  <div
    role="button"
    tabIndex={-1}
    className="row search-result-table-item align-items-center justify-content-between px-3 w-100"
    onClick={() => onResultClick(signalSearchResult)}
  >
    <div className="col-1">
      <img
        src={`/src/assets/pictures/signalicons/${signalSearchResult.type?.replace(/ /g, '_')}.svg`}
        alt={signalSearchResult.type}
      />
    </div>
    <div className="col-1 small">{signalSearchResult.label}</div>
    <div className="col-3">{signalSearchResult.line_code}</div>
    <div className="col-6 small">{signalSearchResult.line_name}</div>
  </div>
);

export default SignalCard;
