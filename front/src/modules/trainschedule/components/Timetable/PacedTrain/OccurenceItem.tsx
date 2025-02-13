import { Dot } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';

const formatDateHours = (d: Date) => dayjs(d).format('HH:mm');
export type Occurence = {
  id: string;
  trainName: string;
  rollingStock?: LightRollingStockWithLiveries;
  startTime: Date;
  arrivalTime: Date;
};
type OccurenceItemProps = { occurence: Occurence };
const OccurenceItem = ({ occurence }: OccurenceItemProps) => {
  const { id, trainName, rollingStock, startTime, arrivalTime } = occurence;

  return (
    <div className="occurence-item">
      <div className="occurence-item-dot">
        <Dot variant="fill" />
      </div>
      <div className="occurence-item-label">{trainName}</div>
      <div className="rolling-stock">
        {rollingStock && (
          <div className="rolling-stock-img">
            <RollingStock2Img rollingStock={rollingStock} />
          </div>
        )}
      </div>
      <div className="occurence-item-times">
        <div className="occurence-item-time">{formatDateHours(startTime)}</div>
        <div className="occurence-item-time arrival-time">{formatDateHours(arrivalTime)}</div>
      </div>
    </div>
  );
};

export default OccurenceItem;
