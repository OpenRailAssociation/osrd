import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateInfraID } from 'reducers/osrdconf';
import { get } from 'common/requests';
import icon from 'assets/pictures/layersicons/layer_tiv.svg';
import InfraSelectorModal from 'applications/osrd/components/InfraSelector/InfraSelectorModal';

const infraURL = '/osrd/infra';

export default function InfraSelector() {
  const dispatch = useDispatch();
  const [infrasList, setInfrasList] = useState(undefined);
  const [selectedInfra, setSelectedInfra] = useState(undefined);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation();

  const getInfra = async (id) => {
    try {
      const infraQuery = await get(`${infraURL}/${id}`, {}, true);
      setSelectedInfra(infraQuery);
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  const getInfrasList = async () => {
    try {
      const infrasListQuery = await get(infraURL, {}, true);
      setInfrasList(infrasListQuery);
      console.log(infrasListQuery);
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  const setInitialInfra = () => {
    if (osrdconf.infraID !== undefined) {
      getInfra(osrdconf.infraID);
    } else if (infrasList !== undefined) {
      setSelectedInfra(infrasList.results[0]);
      dispatch(updateInfraID(infrasList.results[0].id));
    } else {
      getInfrasList();
    }
  };

  useEffect(() => {
    setInitialInfra();
  }, [infrasList, osrdconf.infraID]);

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
          {selectedInfra !== undefined ? (
            <div className="h2 mb-0">
              <img className="mr-1" src={icon} alt="infraIcon" />
              <span className="text-muted">{t('osrdconf:infrastructure')}</span>
              <span className="ml-1">{selectedInfra.name}</span>
              <small className="ml-1 text-primary">{selectedInfra.id}</small>
            </div>
          ) : null }
        </div>
      </div>
      <InfraSelectorModal
        infrasList={infrasList}
      />
    </>
  );
}
