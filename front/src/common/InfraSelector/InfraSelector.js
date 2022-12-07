import React, { useState, useEffect } from 'react';
import { PropTypes } from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateInfraID } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import icon from 'assets/pictures/tracks.svg';
import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import nextId from 'react-id-generator';
import { getInfraID } from 'reducers/osrdconf/selectors';

const infraURL = '/infra/';

export default function InfraSelector(props) {
  const { modalOnly, modalID } = props;
  const dispatch = useDispatch();
  const [infrasList, setInfrasList] = useState(undefined);
  const [selectedInfra, setSelectedInfra] = useState(undefined);
  const infraID = useSelector(getInfraID);

  const { t } = useTranslation(['osrdconf']);

  const getInfra = async (id) => {
    try {
      const infraQuery = await get(`${infraURL}${id}/`, {});
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

  const getInfrasList = async () => {
    try {
      const infrasListQuery = await get(infraURL, {});
      setInfrasList(infrasListQuery);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveInfraList'),
          message: e.message,
        })
      );
      console.log('ERROR', e);
    }
  };

  const setInitialInfra = () => {
    if (infraID !== undefined) {
      getInfra(infraID);
    } else if (infrasList !== undefined) {
      if (infrasList.results[0] !== undefined) {
        setSelectedInfra(infrasList.results[0]);
        dispatch(updateInfraID(infrasList.results[0].id));
      } else {
        dispatch(
          setFailure({
            name: t('errorMessages.noExistingInfra'),
            message: '',
          })
        );
      }
    } else {
      getInfrasList();
    }
  };

  useEffect(() => {
    setInitialInfra();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infrasList, infraID]);

  useEffect(() => {
    if (!infrasList) {
      getInfrasList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return modalOnly ? (
    <InfraSelectorModal infrasList={infrasList} modalID={modalID} />
  ) : (
    <>
      <div className="osrd-config-item mb-2">
        <div
          className="osrd-config-item-container osrd-config-item-clickable"
          role="button"
          tabIndex="-1"
          onClick={getInfrasList}
          data-toggle="modal"
          data-target={`#${modalID}`}
        >
          <div className="h2 mb-0">
            <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
            <span className="text-muted">{t('infrastructure')}</span>
            {selectedInfra !== undefined ? (
              <>
                <span className="ml-1">{selectedInfra.name}</span>
                <small className="ml-1 text-primary">{selectedInfra.id}</small>
              </>
            ) : (
              <span className="ml-3">
                <DotsLoader />
              </span>
            )}
          </div>
        </div>
      </div>
      <InfraSelectorModal infrasList={infrasList} modalID={modalID} />
    </>
  );
}

InfraSelector.defaultProps = {
  modalOnly: false,
  modalID: `infra-selector-modal-${nextId()}`,
};
InfraSelector.propTypes = {
  modalOnly: PropTypes.bool,
  modalID: PropTypes.string,
};
