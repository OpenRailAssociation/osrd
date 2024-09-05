import type { SearchResultItemSignal } from 'common/api/osrdEditoastApi';
import mainConfig from 'config/config';

type SignalCardProps = {
  signalSearchResult: SearchResultItemSignal;
  onResultClick: (results: SearchResultItemSignal) => void;
};
const SignalCard = ({ signalSearchResult, onResultClick }: SignalCardProps) => (
  <div
    role="button"
    tabIndex={-1}
    className="row search-result-table-item align-items-center justify-content-between px-3 w-100"
    onClick={() => onResultClick(signalSearchResult)}
  >
    <div className="col-1">
      {typeof signalSearchResult.sprite === 'string' &&
        typeof signalSearchResult.sprite_signaling_system === 'string' && (
          <img
            src={`${mainConfig.proxy_editoast}/sprites/${signalSearchResult.sprite_signaling_system}/${signalSearchResult.sprite}.svg`}
            alt={`${signalSearchResult.sprite_signaling_system} ${signalSearchResult.sprite}`}
          />
        )}
    </div>
    <div className="col-1 small">{signalSearchResult.label}</div>
    <div className="col-3">{signalSearchResult.line_code}</div>
    <div className="col-6 small">{signalSearchResult.line_name}</div>
  </div>
);

export default SignalCard;
