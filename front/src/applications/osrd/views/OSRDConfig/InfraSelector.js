import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateInfraID } from 'reducers/osrdconf';
import { setFailure } from 'reducers/main.ts';
import { get } from 'common/requests';
import icon from 'assets/pictures/tracks.svg';
import InfraSelectorModal from 'applications/osrd/components/InfraSelector/InfraSelectorModal';
import DotsLoader from 'common/DotsLoader/DotsLoader';

const infraURL = '/infra/';

export default function InfraSelector() {
  const dispatch = useDispatch();
  const [infrasList, setInfrasList] = useState(undefined);
  const [selectedInfra, setSelectedInfra] = useState(undefined);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['osrdconf']);

  const getInfra = async (id) => {
    try {
      const infraQuery = await get(`${infraURL}${id}/`, {});
      setSelectedInfra(infraQuery);
    } catch (e) {
      dispatch(setFailure({
        name: t('errorMessages.unableToRetrieveInfra'),
        message: e.message,
      }));
      console.log('ERROR', e);
    }
  };

  const getInfrasList = async () => {
    try {
      const infrasListQuery = await get(infraURL, {});
      setInfrasList(infrasListQuery);
    } catch (e) {
      dispatch(setFailure({
        name: t('errorMessages.unableToRetrieveInfraList'),
        message: e.message,
      }));
      console.log('ERROR', e);
    }
  };

  const setInitialInfra = () => {
    if (infraID !== undefined) {
      getInfra(infraID);
    } else if (infrasList !== undefined) {
      setSelectedInfra(infrasList.results[0]);
      dispatch(updateInfraID(infrasList.results[0].id));
    } else {
      getInfrasList();
    }
  };

  useEffect(() => {
    setInitialInfra();
  }, [infrasList, infraID]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div
          className="osrd-config-item-container osrd-config-item-clickable"
          role="button"
          tabIndex="-1"
          onClick={getInfrasList}
          data-toggle="modal"
          data-target="#infra-selector-modal"
        >
          <div className="h2 mb-0">
            <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
            <span className="text-muted">{t('infrastructure')}</span>
            {selectedInfra !== undefined ? (
              <>
                <span className="ml-1">{selectedInfra.name}</span>
                <small className="ml-1 text-primary">{selectedInfra.id}</small>
              </>
            ) : <span className="ml-3"><DotsLoader /></span> }
          </div>
        </div>
      </div>
      <InfraSelectorModal
        infrasList={infrasList}
      />
    </>
  );
}
