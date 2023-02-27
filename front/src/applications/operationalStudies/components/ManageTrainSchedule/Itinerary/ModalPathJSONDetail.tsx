import React, { useEffect, useState, useRef, useContext, ComponentType } from 'react';
import { Dispatch } from 'redux';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getPathfindingID } from 'reducers/osrdconf/selectors';
import { getPathfindingID as getPathfindingIDStdcm} from 'reducers/osrdStdcmConf/selectors';

interface ModalPathJSONDetailProps {
  dispatch?: Dispatch
  getPathJSON?: () => object
  t?: (s: string) => string;
  pathfindingID: number | string
}

export function withStdcmData<T>(Component: ComponentType<T>) {
  return (hocProps: ModalPathJSONDetailProps) => {
    const dispatch = useDispatch();
    const pathfindingID = useSelector(getPathfindingIDStdcm);
    const { t } = useTranslation('operationalStudies/manageTrainSchedule');
    const getPathJSON = async (zoom: number, params: object) => {
      try {
        const pathJSON = await get(`/pathfinding/${pathfindingID}/`, { params });
        return pathJSON
      } catch (e: any) {
        dispatch(
          setFailure({
            name: t('errorMessages.unableToRetrievePath'),
            message: `${e.message} : ${e.response && e.response.data.detail}`,
          })
        );
        console.log('ERROR', e);
      }
    };

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        pathfindingID={pathfindingID}
        getPathJSON={getPathJSON}
        t={t}
      />
    );
  };
}

export function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: ModalPathJSONDetailProps) => {
    const dispatch = useDispatch();
    const pathfindingID = useSelector(getPathfindingID);
    const { t } = useTranslation('operationalStudies/manageTrainSchedule');
    const getPathJSON = async (zoom: number, params: object) => {
      try {
        const pathJSON = await get(`/pathfinding/${pathfindingID}/`, { params });
        return pathJSON
      } catch (e) {
        dispatch(
          setFailure({
            name: t('errorMessages.unableToRetrievePath'),
            message: `${e.message} : ${e.response && e.response.data.detail}`,
          })
        );
        console.log('ERROR', e);
      }
    };

    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        pathfindingID={pathfindingID}
        getPathJSON={getPathJSON}
        t={t}
      />
    );
  };
}

export default function ModalPathJSONDetail() {
  
  const { dispatch = () => null, pathfindingID, t = () => null, getPathJSON = () => null } = props
  const [pathJSONDetail, setPathJSONDetail] = useState(undefined);
  const textareaRef = useRef(null);
  
  const { closeModal } = useContext(ModalContext);

  

  const copyToClipboard = (e:any) => {
    if(textareaRef !== null) textareaRef?.current.select();
    document.execCommand('copy');
    // This is just personal preference.
    // I prefer to not show the whole text area selected.
    e.target.focus();
  };

  useEffect(() => {
    if (pathfindingID) {
      setPathJSONDetail(getPathJSON());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathfindingID]);

  return (
    <>
      <ModalHeaderSNCF>
        <div>
        <h1>{`PathFinding n°${pathfindingID}`}</h1>
        <button className="btn btn-only-icon close" type="button" onClick={closeModal}>
          <i className="icons-close" />
        </button>
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="form-control-container" style={{ maxHeight: '50vh' }}>
          <textarea
            className="form-control stretchy"
            ref={textareaRef}
            value={JSON.stringify(pathJSONDetail, null, 2)}
            style={{ maxHeight: '50vh' }}
          />
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <button className="btn btn-primary" type="button" onClick={copyToClipboard}>
          Copy to clipboard
        </button>
      </ModalFooterSNCF>
    </>
  );
}
