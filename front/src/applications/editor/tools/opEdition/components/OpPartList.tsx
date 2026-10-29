import { useContext, useEffect, useRef } from 'react';

import cx from 'classnames';
import { clamp } from 'lodash';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowDown, FaArrowUp, FaRegDotCircle, FaTimes } from 'react-icons/fa';
import { RiPinDistanceLine } from 'react-icons/ri';

import EditorContext from 'applications/editor/context';
import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import { getPointAt } from 'applications/editor/tools/rangeEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import type { OperationalPointPart } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import { useAppDispatch } from 'store';

import type { OpEditionState } from '../types';
import { movePart, removePart, updatePart } from '../utils';

const CENTER_PART_MIN_ZOOM = 16;

type MoveDirection = 'up' | 'down';

function getPartFieldId(
  partIndex: number,
  field: keyof OperationalPointPart | 'kp' | `move-${MoveDirection}`
) {
  return `op-part-${partIndex}-${field}`;
}

// Makes two list items visually slide to each other's place.
// Resolves when the animations end, and rejects if they are interrupted by
// another swap.
function animateSwap(a: HTMLElement, b: HTMLElement, swap: () => void) {
  const aTop = a.getBoundingClientRect().top;
  const bTop = b.getBoundingClientRect().top;
  [a, b].forEach((element) => element.getAnimations().forEach((animation) => animation.cancel()));

  // Items are keyed by index, so swap() exchanges their contents, not their
  // DOM nodes. Node a now shows what was at bTop, and b what was at aTop
  swap();

  const moves: [HTMLElement, number][] = [
    [a, bTop],
    [b, aTop],
  ];

  return Promise.all(
    moves.map(([element, oldTop]) => {
      const offset = oldTop - element.getBoundingClientRect().top;
      return element.animate(
        [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
        { duration: 200, easing: 'ease-in-out' }
      ).finished;
    })
  );
}

// Shows the track ID until the track is loaded
const PartTrackSumUp = ({ id, trackState }: { id: string; trackState?: TrackState }) => {
  const { t } = useTranslation();

  if (trackState?.type === 'error')
    return <div className="text-danger">{t('Editor.tools.op-edition.track-error', { id })}</div>;
  if (trackState?.type !== 'success') return <div className="font-weight-medium">{id}</div>;

  const { track_name, line_name } = trackState.track.properties.extensions?.sncf || {};
  return (
    <div>
      <div className="font-weight-medium">{track_name || id}</div>
      {line_name && <div>{line_name}</div>}
      {track_name && <div className="small text-muted">{id}</div>}
    </div>
  );
};

const OpPartItem = ({
  part,
  index,
  partsCount,
}: {
  part: OperationalPointPart;
  index: number;
  partsCount: number;
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();
  const { viewport } = useMapSettings();
  const {
    state: { entity, trackSectionsCache, selectedPartIndex },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<OpEditionState>;
  const trackState = trackSectionsCache[part.track];
  const isSelected = selectedPartIndex === index;
  const trackLength =
    trackState?.type === 'success' ? trackState.track.properties.length : undefined;
  const itemRef = useRef<HTMLLIElement>(null);

  // Scroll to the form when a new part is selected from the map:
  useEffect(() => {
    const item = itemRef.current;
    if (!isSelected || !item || item.contains(document.activeElement)) return;
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    item.querySelector('input')?.focus({ preventScroll: true });
  }, [isSelected]);

  const update = (patch: Partial<OperationalPointPart>) =>
    setState({ entity: updatePart(entity, index, patch) });

  const move = (direction: MoveDirection) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    // Buttons are only aria-disabled, so that they keep the focus:
    if (newIndex < 0 || newIndex >= partsCount) return;

    // flushSync makes React update the DOM right away, so that we can measure
    // the new positions and focus the new button just after:
    const swap = () =>
      flushSync(() =>
        setState({ entity: movePart(entity, index, newIndex), hoveredPartIndex: null })
      );

    const item = itemRef.current;
    const sibling = direction === 'up' ? item?.previousElementSibling : item?.nextElementSibling;
    if (!item || !(sibling instanceof HTMLElement)) return;

    const moves = animateSwap(item, sibling, swap);

    // Keep the focus on the clicked button, which now belongs to the moved
    // part. This also selects the moved part. There is no scroll yet, since
    // the item is still drawn at its old position:
    const button = document.getElementById(getPartFieldId(newIndex, `move-${direction}`));
    button?.focus({ preventScroll: true });
    moves.then(
      () => button?.closest('li')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      () => {
        /* Slides can be canceled by a fast next move */
      }
    );
  };

  return (
    <li ref={itemRef}>
      <div
        className={cx('op-part d-flex flex-row', isSelected && 'selected')}
        onFocus={() => setState({ selectedPartIndex: index })}
      >
        <div className="flex-shrink-0 mr-3 d-flex flex-column">
          <button
            type="button"
            className="btn btn-primary btn-sm px-2 mb-1"
            aria-label={t('Editor.tools.op-edition.center-part')}
            title={t('Editor.tools.op-edition.center-part')}
            disabled={trackState?.type !== 'success'}
            onClick={() => {
              if (trackState?.type !== 'success') return;
              const [longitude, latitude] = getPointAt(trackState.track, part.position);
              // Zooms in, but never out:
              const zoom = Math.max(viewport.zoom, CENTER_PART_MIN_ZOOM);
              dispatch(updateViewport({ longitude, latitude, zoom }));
            }}
          >
            <FaRegDotCircle />
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm px-2 mb-3"
            aria-label={t('common.delete')}
            title={t('common.delete')}
            onClick={() =>
              setState({
                entity: removePart(entity, index),
                hoveredPartIndex: null,
                selectedPartIndex: null,
              })
            }
          >
            <FaTimes />
          </button>
          <button
            id={getPartFieldId(index, 'move-up')}
            type="button"
            className={cx('btn btn-primary btn-sm px-2 mb-1', index === 0 && 'disabled')}
            aria-label={t('Editor.tools.op-edition.move-part-up')}
            title={t('Editor.tools.op-edition.move-part-up')}
            aria-disabled={index === 0}
            onClick={() => move('up')}
          >
            <FaArrowUp />
          </button>
          <button
            id={getPartFieldId(index, 'move-down')}
            type="button"
            className={cx('btn btn-primary btn-sm px-2', index === partsCount - 1 && 'disabled')}
            aria-label={t('Editor.tools.op-edition.move-part-down')}
            title={t('Editor.tools.op-edition.move-part-down')}
            aria-disabled={index === partsCount - 1}
            onClick={() => move('down')}
          >
            <FaArrowDown />
          </button>
        </div>
        <div className="flex-grow-1 flex-shrink-1">
          <div className="mb-2">
            <PartTrackSumUp id={part.track} trackState={trackState} />
          </div>
          <div className="mb-2">
            <InputSNCF
              id={getPartFieldId(index, 'local_track_name')}
              type="text"
              label={`${t('Editor.tools.op-edition.part-fields.local_track_name')} *`}
              value={part.local_track_name}
              inputProps={{ required: true }}
              whiteBG
              sm
              noMargin
              // Focuses new parts, that are added as selected
              focus={isSelected}
              onChange={(e) => update({ local_track_name: e.target.value })}
            />
          </div>
          <div className="row">
            <div className="col-6">
              <InputSNCF
                id={getPartFieldId(index, 'position')}
                type="number"
                label={t('Editor.tools.op-edition.part-fields.position')}
                value={part.position}
                min={0}
                max={trackLength}
                step="any"
                unit="m"
                whiteBG
                sm
                onChange={(e) => {
                  if (e.target.value === '') return;
                  update({ position: clamp(Number(e.target.value), 0, trackLength ?? Infinity) });
                }}
              />
            </div>
            <div className="col-6">
              <InputSNCF
                id={getPartFieldId(index, 'kp')}
                type="text"
                label={t('Editor.tools.op-edition.part-fields.kp')}
                value={part.extensions?.sncf?.kp ?? ''}
                whiteBG
                sm
                onChange={(e) =>
                  update({
                    extensions: { sncf: e.target.value ? { kp: e.target.value } : null },
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-2 small text-muted">{index + 1}</div>
      </div>
    </li>
  );
};

const OpPartList = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
  } = useContext(EditorContext) as ExtendedEditorContextType<OpEditionState>;
  const { parts } = entity.properties;

  return (
    <div className="mt-4 pt-4 border-top">
      <h4 className="pb-2">
        <RiPinDistanceLine /> {t('Editor.tools.op-edition.parts')} *
      </h4>
      {parts.length === 0 ? (
        <p className="text-muted text-center">{t('Editor.tools.op-edition.no-parts')}</p>
      ) : (
        <ul className="list-unstyled">
          {parts.map((part, index) => (
            <OpPartItem key={index} part={part} index={index} partsCount={parts.length} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default OpPartList;
