import React, { useState, useEffect, useCallback, useContext } from 'react';
import { isNil } from 'lodash';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';
import turfCenter from '@turf/center';

import { LoaderFill, Spinner } from '../../../../common/Loader';
import { updateViewport } from '../../../../reducers/map';
import EditorContext from '../../context';
import { getMixedEntities } from '../../data/api';
import SelectionTool from '../../tools/selection/tool';
import useInfraErrors from './useInfraErrors';
import InfraErrorComponent from './InfraError';
import {
  InfraError,
  InfraErrorLevel,
  InfraErrorType,
  InfraErrorLevelList,
  InfraErrorTypeList,
} from './types';

interface InfraErrorsListProps {
  infraID: number;
}

const InfraErrorsList: React.FC<InfraErrorsListProps> = ({ infraID }) => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<Array<InfraError>>([]);
  const [filterErrorLevel, setFilterErrorLevel] = useState<InfraErrorLevel>('all');
  const [filterErrorType, setFilterErrorType] = useState<InfraErrorType | undefined>(undefined);
  const { loading, error, next, total, fetch } = useInfraErrors();
  const [loadingEntity, setLoadingEntity] = useState(false);

  useEffect(() => {
    fetch(infraID, {
      page: 1,
      error_type: filterErrorType,
      level: filterErrorLevel,
    }).then((result) => {
      setErrors(result ?? []);
    });
  }, [infraID, fetch, filterErrorType, filterErrorLevel]);

  const dispatch = useDispatch();
  const { closeModal, switchTool } = useContext(EditorContext);

  const gotoMap = useCallback(
    async (item: InfraError) => {
      try {
        setLoadingEntity(true);
        const entitiesMap = await getMixedEntities(infraID, [
          {
            id: item.information.obj_id,
            type: item.information.obj_type,
          },
        ]);
        if (entitiesMap[item.information.obj_id]) {
          // select the item in the editor scope
          switchTool(SelectionTool, { selection: [entitiesMap[item.information.obj_id]] });

          // center the map on the object
          if (item.geographic) {
            const geoCenter = turfCenter(item.geographic);
            dispatch(
              updateViewport({
                longitude: geoCenter.geometry.coordinates[0],
                latitude: geoCenter.geometry.coordinates[1],
                zoom: 20,
              })
            );
          }

          // closing the modal
          closeModal();
        }
      } finally {
        setLoadingEntity(false);
      }
    },
    [infraID, closeModal, switchTool, dispatch]
  );

  return (
    <div>
      <div className="rounded bg-light py-1 mt-3">
        <div className="form-group row align-items-center rounded bg-white p-2 m-3">
          <label htmlFor="filterLevel" className="col-sm-4 col-form-label">
            {t('Editor.infra-errors.list.filter-level')}
          </label>
          <div className="col-sm-8">
            <select
              id="filterLevel"
              className="form-control"
              value={filterErrorLevel}
              onChange={(e) => setFilterErrorLevel(e.target.value)}
            >
              {InfraErrorLevelList.map((item) => (
                <option value={item}>{t(`Editor.infra-errors.error-level.${item}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group row align-items-center rounded bg-white p-2 m-3">
          <label htmlFor="filterType" className="col-sm-4 col-form-label">
            {t('Editor.infra-errors.list.filter-type')}
          </label>
          <div className="col-sm-8">
            <select
              id="filterType"
              className="form-control"
              value={filterErrorType}
              onChange={(e) =>
                setFilterErrorType(e.target.value !== 'all' ? e.target.value : undefined)
              }
            >
              <option value="all">{t(`Editor.infra-errors.error-type.all`)}</option>
              {InfraErrorTypeList.map((item, i) => (
                <option value={item} key={i}>
                  {t(`Editor.infra-errors.error-type.${item}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!loading && (
        <p className="text-center text-info my-3">
          {!isNil(total) && total > 0 ? (
            <>{t('Editor.infra-errors.list.total-error', { total })}</>
          ) : (
            <>{t('Editor.infra-errors.list.no-error')}</>
          )}
        </p>
      )}
      {error && (
        <p className="text-danger text-center my-3">{t('Editor.infra-errors.list.error')}</p>
      )}

      <InfiniteScroll
        loader={
          <div className="text-center p-3">
            <Spinner />
          </div>
        }
        style={{ overflow: 'hidden' }}
        dataLength={errors.length}
        hasMore={next !== null}
        scrollableTarget="modal-body"
        next={async () => {
          const result = await fetch(infraID, {
            page: next ?? 1,
            error_type: filterErrorType,
            level: filterErrorLevel,
          });
          setErrors((prev) => [...prev, ...(result ?? [])]);
        }}
      >
        {errors && (
          <ul className="list-group">
            {errors.map((item, index) => (
              <li key={index} className="list-group-item management-item">
                <InfraErrorComponent error={item} index={index + 1}>
                  <ul>
                    <li>
                      <button className="dropdown-item" type="button" onClick={() => gotoMap(item)}>
                        Sélectionner sur la carte
                      </button>
                    </li>
                  </ul>
                </InfraErrorComponent>
              </li>
            ))}
          </ul>
        )}
      </InfiniteScroll>

      {(loading || loadingEntity) && <LoaderFill />}
    </div>
  );
};

export default InfraErrorsList;
