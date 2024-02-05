import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useInfraID } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import { useAppDispatch } from 'store';
import { setFailure } from 'reducers/main';

import InfraSelectorModal from './InfraSelectorModal';

type InfraSelectorProps = {
  isInEditor?: boolean;
};

const InfraSelector = ({ isInEditor }: InfraSelectorProps) => {
  const dispatch = useAppDispatch();
  const infraID = useInfraID();
  const [getInfraByID] = osrdEditoastApi.endpoints.getInfraById.useLazyQuery({});
  const { t } = useTranslation(['infraManagement']);

  const getInfra = async (id: number) => {
    getInfraByID({ id })
      .unwrap()
      .catch((e) =>
        dispatch(
          setFailure({
            name: t('errorMessages.unableToRetrieveInfra'),
            message: e.message,
          })
        )
      );
  };

  useEffect(() => {
    if (infraID !== undefined) {
      getInfra(infraID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  return <InfraSelectorModal isInEditor={isInEditor} />;
};

export default InfraSelector;
