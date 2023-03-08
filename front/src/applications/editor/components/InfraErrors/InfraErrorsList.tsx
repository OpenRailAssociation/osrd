import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';

import { LoaderFill, Spinner } from '../../../../common/Loader';
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
  onErrorClick: (infraId: number, item: InfraError) => void | Promise<void>;
}

const InfraErrorsList: React.FC<InfraErrorsListProps> = ({ infraID, onErrorClick }) => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<Array<InfraError>>([]);
  const [filterErrorLevel, setFilterErrorLevel] = useState<InfraErrorLevel>('all');
  const [filterErrorType, setFilterErrorType] = useState<InfraErrorType | undefined>(undefined);
  const { loading, error, next, total, fetch } = useInfraErrors();

  useEffect(() => {
    fetch(infraID, {
      page: 1,
      error_type: filterErrorType,
      level: filterErrorLevel,
    }).then((result) => {
      setErrors(result ?? []);
    });
  }, [infraID, fetch, filterErrorType, filterErrorLevel]);

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
                <option key={item} value={item}>
                  {t(`Editor.infra-errors.error-level.${item}`)}
                </option>
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
          {t('Editor.infra-errors.list.total-error', { count: total || 0 })}
        </p>
      )}
      {error && (
        <p className="text-danger text-center my-3">{t('Editor.infra-errors.list.error')}</p>
      )}

      <InfiniteScroll
        loader={<Spinner className="text-center p-3" />}
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
                  <ul className="list-unstyled">
                    <li>
                      <button
                        className="dropdown-item"
                        type="button"
                        onClick={() => onErrorClick(infraID, item)}
                      >
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

      {loading && <LoaderFill />}
    </div>
  );
};

export default InfraErrorsList;
