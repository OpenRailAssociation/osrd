import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import { BsFillExclamationOctagonFill } from 'react-icons/bs';
import { isNil, uniqueId } from 'lodash';

import { EditorEntity } from 'types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { InfraErrorLine } from './InfraErrors/InfraError';

const EntityError: FC<{ entity: EditorEntity; className?: string }> = ({ entity, className }) => {
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);
  const { data } = osrdEditoastApi.endpoints.getInfraByIdErrors.useQuery(
    {
      // Infra can be undefined, but in this case the query is skipped
      id: infraID || -1,
      objectId: entity.properties.id,
    },
    { skip: isNil(infraID) }
  );

  const hasError = useMemo(() => {
    if (isNil(infraID)) return false;
    return data?.results && data.results.length > 0;
  }, [infraID, data]);

  return hasError ? (
    <div className={cx('entity-errors-linked', className)}>
      <h4>
        <BsFillExclamationOctagonFill className="mr-1" />
        {t('Editor.entities.errors-linked')}
      </h4>
      <div className="small">
        {data?.results?.map((e) => (
          <InfraErrorLine key={uniqueId()} error={e.information} />
        ))}
      </div>
    </div>
  ) : null;
};

export default EntityError;
