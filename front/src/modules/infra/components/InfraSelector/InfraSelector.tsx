import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import InfraSelectorModal from './InfraSelectorModal';

type InfraSelectorProps = {
  isInEditor?: boolean;
};

const InfraSelector = ({ isInEditor }: InfraSelectorProps) => {
  const dispatch = useAppDispatch();
  const infraID = useInfraID();
  const [getInfraByInfraId] = osrdEditoastApi.endpoints.getInfraByInfraId.useLazyQuery({});
  const { t } = useTranslation(['infraManagement']);

  const getInfra = async (infraId: number) => {
    getInfraByInfraId({ infraId })
      .unwrap()
      .catch((e) =>
        dispatch(
          setFailure(castErrorToFailure(e, { name: t('errorMessages.unableToRetrieveInfra') }))
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
