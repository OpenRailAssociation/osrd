import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';
import { isNil, sortBy, uniqueId } from 'lodash';
import { FaDiamondTurnRight } from 'react-icons/fa6';
import { useDispatch, useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { LoaderFill, Spinner } from 'common/Loaders';
import { updateFiltersIssue } from 'reducers/editor';
import { getEditorIssues } from 'reducers/editor/selectors';

import { EDITOAST_TYPES, EditoastType } from '../../tools/types';
import { InfraErrorBox } from './InfraError';
import {
  InfraError,
  InfraErrorLevel,
  InfraErrorTypeLabel,
  InfraErrorLevelList,
  allInfraErrorTypes,
  infraErrorTypeList,
} from './types';

interface InfraErrorsListProps {
  infraID: number;
  onErrorClick: (infraId: number, item: InfraError) => void | Promise<void>;
}

const InfraErrorsList: React.FC<InfraErrorsListProps> = ({ infraID, onErrorClick }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const { filterLevel, filterType } = useSelector(getEditorIssues);
  const [loading, setLoading] = useState<boolean>(false);

  // list of issues
  const [errors, setErrors] = useState<Array<InfraError>>([]);
  // Error types filtered in correlatino with error level
  const [errorTypeList, setErrorTypeList] = useState<InfraErrorTypeLabel[]>(allInfraErrorTypes);

  // Query to retrieve the issue with the API
  const [getInfraErrors] = osrdEditoastApi.endpoints.getInfraByInfraIdErrors.useLazyQuery({});
  const fetch = useCallback(
    async (id: number, page: number, level: InfraErrorLevel, errorType?: InfraErrorTypeLabel) => {
      setLoading(true);
      try {
        const response = await getInfraErrors({
          infraId: id,
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
        ? allInfraErrorTypes
        : [...infraErrorTypeList[filterLevel]];
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
            options={InfraErrorLevelList.map((item) => ({
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
                  filterType:
                    e.target.value !== 'all' ? (e.target.value as InfraErrorTypeLabel) : null,
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
            {t('Editor.infra-errors.list.total-error', { count: total || 0 })}
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
                    {EDITOAST_TYPES.includes(
                      item.information.obj_type as EditoastType // EditoastType < ObjectType
                    ) && (
                      <button
                        className="dropdown-item no-close-modal"
                        type="button"
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
