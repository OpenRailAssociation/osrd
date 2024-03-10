import React, { useState, useEffect, useCallback } from 'react';

import { isNil, sortBy, uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';
import { FaDiamondTurnRight } from 'react-icons/fa6';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useSelector } from 'react-redux';

import { EDITOAST_TYPES } from 'applications/editor/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { LoaderFill, Spinner } from 'common/Loaders';
import { getEditorIssues } from 'reducers/editor/selectors';
import { updateFiltersIssue } from 'reducers/editor/thunkActions';
import { useAppDispatch } from 'store';

import { INFRA_ERRORS, INFRA_ERRORS_BY_LEVEL } from './consts';
import { InfraErrorBox } from './InfraError';
import type { InfraError, InfraErrorLevel, InfraErrorType } from './types';

const INFRA_ERROR_LEVELS: Array<NonNullable<InfraErrorLevel>> = ['all', 'errors', 'warnings'];

interface InfraErrorsListProps {
  infraID: number;
  onErrorClick: (infraId: number, item: InfraError) => void | Promise<void>;
}

const InfraErrorsList: React.FC<InfraErrorsListProps> = ({ infraID, onErrorClick }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const { filterLevel, filterType } = useSelector(getEditorIssues);
  const [loading, setLoading] = useState<boolean>(false);

  // list of issues
  const [errors, setErrors] = useState<Array<InfraError>>([]);
  // Error types filtered in correlatino with error level
  const [errorTypeList, setErrorTypeList] = useState<InfraErrorType[]>(INFRA_ERRORS);

  // Query to retrieve the issue with the API
  const [getInfraErrors] = osrdEditoastApi.endpoints.getInfraByIdErrors.useLazyQuery({});
  const fetch = useCallback(
    async (id: number, page: number, level: InfraErrorLevel, errorType?: InfraErrorType) => {
      setLoading(true);
      try {
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [getInfraErrors]
  );

  /**
   * When error level changed
   * => set the error type list accordly
   */
  useEffect(() => {
    const types =
      isNil(filterLevel) || filterLevel === 'all'
        ? INFRA_ERRORS
        : [...INFRA_ERRORS_BY_LEVEL[filterLevel]];
    const sortedTypes = sortBy(types, (type) => t(`Editor.infra-errors.error-type.${type}.name`));
    setErrorTypeList(sortedTypes);
  }, [filterLevel]);

  /**
   * When the infra or type or level changed
   * => fetch data of the first page
   */
  useEffect(() => {
    fetch(infraID, 1, filterLevel, filterType ?? undefined);
  }, [infraID, fetch, filterType, filterLevel]);

  return (
    <div className="editor-infra-errors-list">
      <div className="row align-items-center">
        <div className="col-md-6 pb-3 pb-md-0">
          <OptionsSNCF
            name="filterLevel"
            options={INFRA_ERROR_LEVELS.map((item) => ({
              value: item || '',
              label: t(`Editor.infra-errors.error-level.${item}`),
            }))}
            selectedValue={filterLevel || 'all'}
            onChange={(e) => {
              dispatch(
                updateFiltersIssue(infraID, { filterLevel: e.target.value as InfraErrorLevel })
              );
            }}
          />
        </div>
        <div className="col-md-6">
          <select
            aria-label={t('Editor.infra-errors.list.filter-type')}
            id="filterType"
            className="form-control"
            value={filterType || 'all'}
            onChange={(e) => {
              dispatch(
                updateFiltersIssue(infraID, {
                  filterType: e.target.value !== 'all' ? (e.target.value as InfraErrorType) : null,
                })
              );
            }}
          >
            <option value="all">{t(`Editor.infra-errors.error-type.all`)}</option>
            {errorTypeList.map((item, i) => (
              <option value={item} key={i}>
                {t(`Editor.infra-errors.error-type.${item}.name`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="error-count my-3">
        {!loading ? (
          <p className="text-center text-info">
            {t(`Editor.infra-errors.list.total-${filterLevel}`, { count: total || 0 })}
          </p>
        ) : (
          <LoaderFill />
        )}
      </div>
      <div className="mb-2" id="errors-list-container">
        <InfiniteScroll
          loader={<Spinner className="text-center p-3" />}
          style={{ overflow: 'hidden' }}
          dataLength={errors.length}
          hasMore={next !== null}
          scrollableTarget="errors-list-container"
          next={() => fetch(infraID, next ?? 1, filterLevel, filterType ?? undefined)}
        >
          {errors && (
            <ul className="list-group">
              {errors.map((item, index) => (
                <li key={uniqueId()} className="list-group-item management-item">
                  <InfraErrorBox error={item.information} index={index + 1}>
                    {EDITOAST_TYPES.includes(item.information.obj_type) && (
                      <button
                        className="dropdown-item"
                        type="button"
                        aria-label={t('Editor.infra-errors.list.goto-error')}
                        title={t('Editor.infra-errors.list.goto-error')}
                        onClick={() => {
                          onErrorClick(infraID, item);
                        }}
                      >
                        <FaDiamondTurnRight size={30} />
                      </button>
                    )}
                  </InfraErrorBox>
                </li>
              ))}
            </ul>
          )}
        </InfiniteScroll>
      </div>
    </div>
  );
};

export default InfraErrorsList;
