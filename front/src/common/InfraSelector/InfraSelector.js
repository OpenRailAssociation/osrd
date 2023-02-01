import React, { useState, useEffect, useContext } from 'react';
import { PropTypes } from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import icon from 'assets/pictures/components/tracks.svg';
import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { FaLock } from 'react-icons/fa';
import './InfraSelector.scss';
import { INFRA_URL } from './Consts';

export default function InfraSelector(props) {
  const { modalOnly } = props;
  const dispatch = useDispatch();
  const [selectedInfra, setSelectedInfra] = useState(undefined);
  const infraID = useSelector(getInfraID);
  const { openModal } = useContext(ModalContext);

  const { t } = useTranslation(['infraManagement']);

  const getInfra = async (id) => {
    try {
      const infraQuery = await get(`${INFRA_URL}${id}/`, {});
      setSelectedInfra(infraQuery);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveInfra'),
          message: e.message,
        })
      );
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    if (infraID !== undefined) {
      getInfra(infraID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  if (modalOnly) return <InfraSelectorModal />;

  return (
    <div className="osrd-config-item mb-2">
      <div
        className="osrd-config-item-container osrd-config-item-clickable"
        data-testid="infra-selector"
        role="button"
        tabIndex="-1"
        onClick={() => openModal(<InfraSelectorModal />, 'lg')}
      >
        <div className="infraselector-button" data-testid="infraselector-button">
          <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
          {selectedInfra !== undefined ? (
            <>
              <span className="">{selectedInfra.name}</span>
              <span className="ml-1 small align-self-center">({selectedInfra.id})</span>
              {selectedInfra.locked ? (
                <span className="infra-lock ml-auto">
                  <FaLock />
                </span>
              ) : null}
            </>
          ) : (
            t('infraManagement:chooseInfrastructure')
          )}
        </div>
      </div>
    </div>
  );
}

InfraSelector.defaultProps = {
  modalOnly: false,
};
InfraSelector.propTypes = {
  modalOnly: PropTypes.bool,
};
