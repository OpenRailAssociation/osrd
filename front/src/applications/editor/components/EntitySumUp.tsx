import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flatMap, forEach, isNumber, uniq } from 'lodash';
import { useSelector } from 'react-redux';
import { TFunction } from 'i18next';
import cx from 'classnames';

import { Spinner } from 'common/Loader';
import { NEW_ENTITY_ID } from '../data/utils';
import {
  BufferStopEntity,
  CatenaryEntity,
  EditorEntity,
  RouteEntity,
  SignalEntity,
  SpeedSectionEntity,
  SwitchEntity,
  TrackSectionEntity,
} from '../../../types';
import { EditoastType } from '../tools/types';
import { getEntities, getEntity } from '../data/api';
import { getInfraID } from '../../../reducers/osrdconf/selectors';
import { getSpeedSectionsNameString } from '../../../common/Map/Layers/SpeedLimits';

function prettifyStringsArray(strings: string[], finalSeparator: string): string {
  switch (strings.length) {
    case 0:
      return '';
    case 1:
      return strings[0];
    case 2:
      return strings.join(finalSeparator);
    default: {
      const firsts = strings.slice(0, -2);
      const lasts = strings.slice(-2);
      return `${firsts.join(', ')}, ${lasts.join(finalSeparator)}`;
    }
  }
}

const DEFAULT_CLASSES = {
  muted: 'text-muted',
  small: 'small',
  strong: 'strong',
};

async function getAdditionalEntities(
  infra: number,
  entity: EditorEntity
): Promise<Record<string, EditorEntity>> {
  switch (entity.objType) {
    case 'Signal':
    case 'BufferStop':
    case 'Detector': {
      const trackId = (entity as SignalEntity).properties.track;
      if (trackId) {
        try {
          return { [trackId]: await getEntity(infra, trackId, 'TrackSection') };
        } catch (e) {
          return {};
        }
      }
      return {};
    }
    case 'Switch': {
      const trackIDs = flatMap((entity as SwitchEntity).properties.ports, (port) =>
        port.track ? [port.track] : []
      );
      return getEntities<TrackSectionEntity>(infra, trackIDs, 'TrackSection');
    }
    case 'Route': {
      const route = entity as RouteEntity;
      const entryPoint = await getEntity(
        infra,
        route.properties.entry_point.id,
        route.properties.entry_point.type
      );
      const exitPoint = await getEntity(
        infra,
        route.properties.exit_point.id,
        route.properties.exit_point.type
      );
      return { entryPoint, exitPoint };
    }
    default:
      return {};
  }
}

function getSumUpContent(
  entity: EditorEntity,
  additionalEntities: Record<string, EditorEntity>,
  t: TFunction,
  classesOverride: Partial<typeof DEFAULT_CLASSES> | undefined,
  status: string | undefined
): JSX.Element {
  let type = t(`Editor.obj-types.${entity.objType}`);
  let text = '';
  const subtexts: (string | JSX.Element)[] = [];
  const classes = { ...DEFAULT_CLASSES, ...(classesOverride || {}) };
  switch (entity.objType) {
    case 'TrackSection': {
      const trackSection = entity as TrackSectionEntity;
      const attrs = trackSection.properties.extensions?.sncf || {};
      if (attrs.track_name) {
        text = attrs.track_name;
        subtexts.push(trackSection.properties.id);
      } else {
        text = trackSection.properties.id;
      }
      if (attrs.line_name) subtexts.unshift(attrs.line_name);
      break;
    }
    // @ts-expect-error: Here we only deal with the installation_type, the rest is handled with BufferStop and Detector.
    case 'Signal': {
      const signal = entity as SignalEntity;
      if (signal.properties.extensions.sncf.installation_type) {
        type += ` - ${signal.properties.extensions.sncf.installation_type}`;
      }
    }
    // eslint-disable-next-line no-fallthrough
    case 'BufferStop':
    case 'Detector': {
      // This cast is OK since both buffer stops and detectors have same
      // properties:
      const typedEntity = entity as BufferStopEntity;
      const track = typedEntity.properties.track
        ? additionalEntities[typedEntity.properties.track]
        : undefined;

      text = typedEntity.properties.id;
      if (track) {
        subtexts.push(
          <>
            <span className={classes.muted}>
              {t('Editor.tools.select-items.linked-to-line', { count: 1 }).toString()}
            </span>{' '}
            <span>{track.properties?.extensions?.sncf?.line_name || track.properties.id}</span>
          </>
        );
      }

      break;
    }
    case 'Switch': {
      const switchEntity = entity as SwitchEntity;
      const label = switchEntity.properties?.extensions?.sncf?.label;
      const trackNames = uniq(
        flatMap(switchEntity.properties.ports, (port) => {
          const track = additionalEntities[port.track] as TrackSectionEntity | undefined;
          const trackLabel = track?.properties?.extensions?.sncf?.line_name;
          return trackLabel ? [trackLabel] : [];
        })
      );
      if (label) {
        text = label;
        subtexts.push(switchEntity.properties.id);
      } else {
        text = switchEntity.properties.id;
      }
      if (trackNames.length) {
        subtexts.push(
          <>
            <span className={classes.muted}>
              {t('Editor.tools.select-items.linked-to-line', {
                count: trackNames.length,
              }).toString()}
            </span>{' '}
            <span>{prettifyStringsArray(trackNames, ` ${t('common.and')} `)}</span>
          </>
        );
      }
      break;
    }
    case 'Route': {
      const route = entity as RouteEntity;
      text = route.properties.id;
      if (additionalEntities.entryPoint || additionalEntities.exitPoint)
        subtexts.push(
          <div className="d-flex flex-row">
            {additionalEntities.entryPoint && (
              <>
                <span className={cx(classes.muted, 'mr-2')}>
                  {t('Editor.tools.routes-edition.from').toString()}
                </span>{' '}
                <div>
                  <span className={cx(classes.muted, classes.small)}>
                    {t(`Editor.obj-types.${additionalEntities.entryPoint.objType}`).toString()}
                  </span>
                  <div>{additionalEntities.entryPoint.properties.id}</div>
                </div>
              </>
            )}
            {additionalEntities.entryPoint && additionalEntities.exitPoint && (
              <span className="mr-2" />
            )}
            {additionalEntities.exitPoint && (
              <>
                <span className={cx(classes.muted, 'mr-2')}>
                  {t('Editor.tools.routes-edition.to').toString()}
                </span>{' '}
                <div>
                  <span className={cx(classes.muted, classes.small)}>
                    {t(`Editor.obj-types.${additionalEntities.exitPoint.objType}`).toString()}
                  </span>
                  <div>{additionalEntities.exitPoint.properties.id}</div>
                </div>
              </>
            )}
          </div>
        );
      break;
    }
    case 'SpeedSection': {
      const speedSection = entity as SpeedSectionEntity;
      text = speedSection.properties.id;
      subtexts.push(
        <span className={classes.muted}>
          {t('Editor.tools.select-items.linked-to-n-lines', {
            count: speedSection.properties.track_ranges?.length || 0,
          }).toString()}
        </span>
      );
      forEach(speedSection.properties.speed_limit_by_tag, (limit, tag) => {
        subtexts.push(
          <>
            <span className={cx(classes.muted, 'mr-2')}>{tag}</span>{' '}
            <span>{isNumber(limit) ? getSpeedSectionsNameString(limit) : '-'}</span>
          </>
        );
      });
      break;
    }
    case 'Catenary': {
      const catenarySection = entity as CatenaryEntity;
      text = catenarySection.properties.id;
      const { voltage } = catenarySection.properties;
      subtexts.push(
        <>
          <span className={(classes.muted, 'mr-2')}>
            {t('Editor.tools.select-items.linked-to-n-lines', {
              count: catenarySection.properties.track_ranges?.length || 0,
            }).toString()}
          </span>
          <span className={classes.muted}>
            {t('Editor.tools.catenary-edition.voltage', {
              voltage,
            }).toString()}
          </span>
        </>
      );
      break;
    }
    default: {
      text = entity.properties.id;
    }
  }

  return (
    <div>
      <div className={cx(classes.muted, classes.small)}>{type}</div>
      <div>
        {text !== NEW_ENTITY_ID && <span className={classes.strong}>{text}</span>}
        {status && ` (${t(`Editor.item-statuses.${status}`)})`}
      </div>
      {subtexts.map((s, i) => (
        <div className={classes.small} key={i}>
          {s}
        </div>
      ))}
    </div>
  );
}

const EntitySumUp: FC<
  {
    classes?: Partial<typeof DEFAULT_CLASSES>;
    status?: string;
  } & (
    | { entity: EditorEntity; id?: undefined; objType?: undefined }
    | { id: string; objType: EditoastType; entity?: undefined }
  )
> = ({ entity, id, objType, classes, status }) => {
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);
  const [state, setState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'error'; message?: string }
    | { type: 'ready'; entity: EditorEntity; additionalEntities: Record<string, EditorEntity> }
  >({ type: 'idle' });

  useEffect(() => {
    if (state.type === 'idle') {
      setState({ type: 'loading' });

      if (entity) {
        getAdditionalEntities(infraID as number, entity).then((additionalEntities) => {
          setState({
            type: 'ready',
            entity,
            additionalEntities,
          });
        });
      } else {
        getEntity(infraID as number, id as string, objType as EditoastType).then(
          (fetchedEntity) => {
            getAdditionalEntities(infraID as number, fetchedEntity).then((additionalEntities) => {
              setState({
                type: 'ready',
                entity: fetchedEntity,
                additionalEntities,
              });
            });
          }
        );
      }
    }
  }, [entity, id, objType, infraID, state.type]);

  if (state.type === 'loading' || state.type === 'idle') return <Spinner />;

  if (state.type === 'error')
    return (
      <div className="text-danger">
        {state.message || `An error occurred while trying to load ${objType} entity "${id}".`}
      </div>
    );

  return getSumUpContent(entity || state.entity, state.additionalEntities, t, classes, status);
};

export default EntitySumUp;
