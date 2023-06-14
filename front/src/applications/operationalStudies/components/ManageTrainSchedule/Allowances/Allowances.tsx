import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getPathfindingID } from 'reducers/osrdconf/selectors';
import { lengthFromLineCoordinates } from 'utils/geometry';
import EngineeringAddLine from './EngineeringAddLine';
import StandardAddLine from './StandardAddLine';

/*
  "allowances": [
      {
        "allowance_type": "engineering",
        "distribution": "MARECO",
        "capacity_speed_limit": 0,
        "begin_position": 0,
        "end_position": 1000,
        "value": {
          "value_type": "time_per_distance",
          "minutes": 5
        }
      },
      {
        "allowance_type": "standard",
        "default_value": {
          "value_type": "time_per_distance",
          "minutes": 5
        },
        "ranges": [
          {
            "begin_position": 0,
            "end_position": 1000,
            "value": {
              "value_type": "time_per_distance",
              "minutes": 5
            }
          }
        ],
        "distribution": "MARECO",
        "capacity_speed_limit": 0
      }
    ],

*/

const MissingPathFindingMessage = () => {
  const { t } = useTranslation('operationalStudies/allowances');
  return (
    <div className="operational-studies-allowances">
      <div className="missing-pathfinding">{t('missingPathFinding')}</div>
    </div>
  );
};

export default function Allowances() {
  const pathFindingID = useSelector(getPathfindingID);
  const { data: pathFinding } = osrdMiddlewareApi.useGetPathfindingByIdQuery(
    { id: pathFindingID as number },
    { skip: !pathFindingID }
  );
  const pathLength = Math.round(
    lengthFromLineCoordinates(pathFinding?.geographic?.coordinates) * 1000
  );

  return pathFindingID ? (
    <div className="operational-studies-allowances">
      <h2 className="text-uppercase text-muted mb-0 mt-1">Marge de régularité</h2>
      <div className="allowances-container">
        <StandardAddLine pathLength={pathLength} />
      </div>
        <h2 className="text-uppercase text-muted mb-0 mt-1">Marges de construction</h2>
      <div className="allowances-container">
        <EngineeringAddLine pathLength={pathLength} />
      </div>
    </div>
  ) : (
    <MissingPathFindingMessage />
  );
}
