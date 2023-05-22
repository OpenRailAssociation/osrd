import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';

import { LoaderFill, Spinner } from '../../../../common/Loader';
import { osrdEditoastApi } from '../../../../common/api/osrdEditoastApi';
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
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [errors, setErrors] = useState<Array<InfraError>>([]);
  const [filterErrorLevel, setFilterErrorLevel] = useState<InfraErrorLevel>('all');
  const [filterErrorType, setFilterErrorType] = useState<InfraErrorType | undefined>(undefined);
  const [getInfraErrors, { isLoading, error }] =
    osrdEditoastApi.endpoints.getInfraByIdErrors.useLazyQuery({});

  const fetch = useCallback(
    async (id: number, page: number, errorType: InfraErrorType, level: InfraErrorLevel) => {
      const response = await getInfraErrors({
        id,
        page,
        errorType,
        level,
      });
      setErrors((prev) => {
        const apiErrors = response.data ? response.data.results || [] : [];
        return page === 1 ? apiErrors : [...prev, ...apiErrors];
      });
      setTotal(response.data ? response.data.count || 0 : null);
      setNext(response.data ? response.data.next ?? null : null);
    },
    [getInfraErrors]
  );

  /**
   * When the infra or type or level changed
   * => fetch data of the first page
   */
  useEffect(() => {
    fetch(infraID, 1, filterErrorType, filterErrorLevel);
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
              onChange={(e) => setFilterErrorLevel(e.target.value as InfraErrorLevel)}
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
                setFilterErrorType(
                  e.target.value !== 'all' ? (e.target.value as InfraErrorType) : undefined
                )
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

      {!isLoading && (
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
        next={() => fetch(infraID, next ?? 1, filterErrorType, filterErrorLevel)}
      >
        {errors && (
          <ul className="list-group">
            {errors.map((item, index) => (
              <li key={index} className="list-group-item management-item">
                <InfraErrorComponent error={item} index={index + 1}>
                  <ul className="list-unstyled">
                    <li>
                      <button
                        className="dropdown-item no-close-modal"
                        type="button"
                        onClick={() => {
                          onErrorClick(infraID, item);
                        }}
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

      {isLoading && <LoaderFill />}
    </div>
  );
};

export default InfraErrorsList;
