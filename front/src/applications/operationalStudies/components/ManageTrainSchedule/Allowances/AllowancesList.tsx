import React from 'react';
import { Allowance, StandardAllowance } from 'common/api/osrdEditoastApi';
import { TbArrowRightBar } from 'react-icons/tb';

type AllowanceType = 'standard' | 'engineering';

type AllowanceItemProps = {
  allowance: Allowance;
};

type AllowancesListProps = {
  allowances: Allowance[] | StandardAllowance[];
  type: AllowanceType;
};

const AllowanceItem = ({ allowance }: AllowanceItemProps) =>
  'begin_position' in allowance ? (
    <div className="allowance">
      <div className="positions">
        <span className="begin">{allowance.begin_position}</span>
        <span className="separator">
          <TbArrowRightBar />
        </span>
        <span className="end">{allowance.end_position}m</span>
      </div>
      <div className="length">{allowance.end_position - allowance.begin_position}m</div>
      {'allowance_type' in allowance && allowance.allowance_type === 'engineering' && (
        <div className="distribution">{allowance.distribution}</div>
      )}
      <div className="value">
        500<span className="unit">s</span>
      </div>
    </div>
  ) : null;

export default function AllowancesList({ allowances, type }: AllowancesListProps) {
  return allowances ? (
    <div className="allowances-list mt-2">
      {type === 'standard'
        ? allowances
            .find((allowance: Allowance) => allowance.allowance_type === 'standard')
            ?.ranges.map((allowance: Allowance) => <AllowanceItem allowance={allowance} />)
        : allowances
            .filter((allowance) => allowance.allowance_type === 'engineering')
            .map((allowance) => <AllowanceItem allowance={allowance} />)}
    </div>
  ) : (
    <>pas de marges</>
  );
}
