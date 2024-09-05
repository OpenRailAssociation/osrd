import { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { BsBoxArrowInRight } from 'react-icons/bs';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntities } from 'applications/editor/data/api';
import TOOL_NAMES from 'applications/editor/tools/constsToolNames';
import type {
  ElectrificationEntity,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import {
  getEditElectrificationState,
  getEditSpeedSectionState,
} from 'applications/editor/tools/trackEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Spinner } from 'common/Loaders';
import { useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';

const DEFAULT_DISPLAYED_RANGES_COUNT = 3;

interface AttachedRangesItemsListProps {
  id: string;
  itemType: 'SpeedSection' | 'Electrification';
}

/**
 * Generic component to show attached ranges items of a specific type for an edited track section:
 */

const AttachedRangesItemsList = ({ id, itemType }: AttachedRangesItemsListProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const [itemsState, setItemsState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'ready'; itemEntities: SpeedSectionEntity[] | ElectrificationEntity[] }
    | { type: 'error'; message: string }
  >({ type: 'idle' });
  const { switchTool } = useContext(EditorContext) as ExtendedEditorContextType<unknown>;
  const [showAll, setShowAll] = useState(false);

  const [getAttachedItems] =
    osrdEditoastApi.endpoints.getInfraByInfraIdAttachedAndTrackId.useLazyQuery();

  useEffect(() => {
    if (itemsState.type === 'idle' && infraID) {
      setItemsState({ type: 'loading' });
      getAttachedItems({ infraId: infraID, trackId: id })
        .unwrap()
        .then((res: { [key: string]: string[] }) => {
          if (res[itemType]?.length) {
            getEntities(infraID, res[itemType], itemType, dispatch)
              .then((entities) => {
                if (itemType === 'SpeedSection') {
                  setItemsState({
                    type: 'ready',
                    itemEntities: (res[itemType] || []).map(
                      (s) => entities[s] as SpeedSectionEntity
                    ),
                  });
                } else {
                  setItemsState({
                    type: 'ready',
                    itemEntities: (res[itemType] || []).map(
                      (s) => entities[s] as ElectrificationEntity
                    ),
                  });
                }
              })
              .catch((err) => {
                setItemsState({ type: 'error', message: err.message });
              });
          } else {
            setItemsState({ type: 'ready', itemEntities: [] });
          }
        })
        .catch((err) => {
          setItemsState({ type: 'error', message: err.message });
        });
    }
  }, [itemsState]);

  useEffect(() => {
    setItemsState({ type: 'idle' });
  }, [id]);

  if (itemsState.type === 'loading' || itemsState.type === 'idle')
    return (
      <div className="loader mt-4">
        <Spinner />
      </div>
    );
  if (itemsState.type === 'error')
    return (
      <div className="form-error mt-3 mb-3">
        <p>
          {itemsState.message ||
            (itemType === 'SpeedSection'
              ? t('Editor.tools.track-edition.default-speed-sections-error')
              : t('Editor.tools.track-edition.default-electrifications-error'))}
        </p>
      </div>
    );

  return (
    <>
      {!!itemsState.itemEntities.length && (
        <>
          <ul className="list-unstyled">
            {(showAll
              ? itemsState.itemEntities
              : itemsState.itemEntities.slice(0, DEFAULT_DISPLAYED_RANGES_COUNT)
            ).map((entity: SpeedSectionEntity | ElectrificationEntity) => (
              <li key={entity.properties.id} className="d-flex align-items-center mb-2">
                <div className="flex-shrink-0 mr-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    aria-label={t('common.open')}
                    title={t('common.open')}
                    onClick={() => {
                      if (entity.objType === 'SpeedSection') {
                        switchTool({
                          toolType: TOOL_NAMES.SPEED_SECTION_EDITION,
                          toolState: getEditSpeedSectionState(entity as SpeedSectionEntity),
                        });
                      } else
                        switchTool({
                          toolType: TOOL_NAMES.ELECTRIFICATION_EDITION,
                          toolState: getEditElectrificationState(entity as ElectrificationEntity),
                        });
                    }}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <div className="flex-grow-1 flex-shrink-1">
                  <EntitySumUp entity={entity} />
                </div>
              </li>
            ))}
          </ul>
          {itemsState.itemEntities.length > DEFAULT_DISPLAYED_RANGES_COUNT && (
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? t('Editor.tools.track-edition.only-show-n', {
                      count: DEFAULT_DISPLAYED_RANGES_COUNT,
                    })
                  : t('Editor.tools.track-edition.show-more-ranges', {
                      count: itemsState.itemEntities.length - DEFAULT_DISPLAYED_RANGES_COUNT,
                    })}
              </button>
            </div>
          )}
        </>
      )}
      {!itemsState.itemEntities.length && (
        <div className="text-center">
          {itemType === 'SpeedSection'
            ? t('Editor.tools.track-edition.no-linked-speed-section')
            : t('Editor.tools.track-edition.no-linked-electrification')}
        </div>
      )}
    </>
  );
};

export default AttachedRangesItemsList;
