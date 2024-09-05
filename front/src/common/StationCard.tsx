import cx from 'classnames';

import { formatUicToCi } from 'utils/strings';

export interface ImportStation {
  trigram?: string;
  name?: string;
  yardname?: string;
  town?: string;
  department?: string;
  region?: string;
  uic?: number;
  linename?: string;
  pk?: string;
  linecode?: string;
}

type Props = {
  station: ImportStation;
  onClick?: () => void;
  fixedHeight?: boolean;
};

const yardNamesToExclude = ['BV', '00'];

export default function StationCard({ station, onClick, fixedHeight = false }: Props) {
  const { trigram, name, yardname, town, department, region, uic, linename, pk, linecode } =
    station;
  return (
    <div
      className={cx('station-card', { 'fixed-height': fixedHeight })}
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      <div className="station-card-head">
        <span className="station-card-code">{trigram}</span>
        <span className="station-card-name">{name}&nbsp;</span>
        {yardname && !yardNamesToExclude.includes(yardname) && <small>{yardname}</small>}
        {uic && <span className="station-card-uic ml-3">{formatUicToCi(uic)}</span>}
      </div>
      <div className="station-card-localization">
        <span className="station-card-city">{town}</span>
        <span className="station-card-department">{department}</span>
        {department && region && <div className="station-card-separator">/</div>}
        <span className="station-card-region">{region}</span>
      </div>
      {linename && (
        <div className="station-card-footer">
          <span className="station-card-line">{linename}</span>
          {pk && <span className="station-card-pk">PK {pk}</span>}
          <span className="station-card-line-number">{linecode}</span>
        </div>
      )}
    </div>
  );
}
