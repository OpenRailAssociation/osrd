import React from 'react';
import { ISignalSearchResult } from './searchTypes';

type SignalCardProps = {
  signalSearchResult: ISignalSearchResult;
  onResultClick: (results: ISignalSearchResult) => void;
};
const SignalCard = ({ signalSearchResult, onResultClick }: SignalCardProps) => (
  <div
    role="button"
    tabIndex={-1}
    className="row search-result-table-item align-items-center justify-content-between px-3"
    onClick={() => onResultClick(signalSearchResult)}
  >
    <div className="col-1">
      <img
        src={`/signalsSVG/${signalSearchResult.type.replace(/ /g, '_')}.svg`}
        alt={signalSearchResult.type}
      />
    </div>
    <div className="col-1 small">{signalSearchResult.label}</div>
    <div className="col-2">{signalSearchResult.line_code}</div>
    <div className="col-3 small">{signalSearchResult.line_name}</div>
  </div>
);

export default SignalCard;
