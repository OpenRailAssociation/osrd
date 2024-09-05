import { useMemo } from 'react';

import cx from 'classnames';
import { isNil, uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsExclamationOctagon } from 'react-icons/bs';

import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';

import { InfraErrorLine } from './InfraErrors';

const EntityError = ({ entity, className }: { entity: EditorEntity; className?: string }) => {
  const { t } = useTranslation();
  const infraID = useInfraID();
  const { data } = osrdEditoastApi.endpoints.getInfraByInfraIdErrors.useQuery(
    {
      // Infra can be undefined, but in this case the query is skipped
      infraId: infraID!,
      objectId: entity.properties.id,
    },
    { skip: isNil(infraID) }
  );

  const hasError = useMemo(() => {
    if (isNil(infraID)) return false;
    return data?.results && data.results.length > 0;
  }, [infraID, data]);

  if (!hasError) return null;

  return (
    <div className={cx('entity-errors-linked', className)}>
      <h4>
        <BsExclamationOctagon className="mr-1" />
        {t('Editor.entities.errors-linked')}
      </h4>
      <div className="small">
        {data?.results?.map((e) => <InfraErrorLine key={uniqueId()} error={e.information} />)}
      </div>
    </div>
  );
};

export default EntityError;
