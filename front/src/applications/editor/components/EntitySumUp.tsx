import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flatMap, map, uniq } from 'lodash';
import { useSelector } from 'react-redux';
import { TFunction } from 'i18next';
import cx from 'classnames';

import { NEW_ENTITY_ID } from '../data/utils';
import {
  BufferStopEntity,
  EditorEntity,
  SignalEntity,
  SwitchEntity,
  TrackSectionEntity,
} from '../../../types';
import { EditoastType, OSRDConf } from '../tools/types';
import { getEntities, getEntity } from '../data/api';

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
  infra: string,
  entity: EditorEntity
): Promise<Record<string, EditorEntity>> {
  switch (entity.objType) {
    case 'Signal':
    case 'BufferStop':
    case 'Detector': {
      const trackId = (entity as SignalEntity).properties.track;
      if (trackId) return { [trackId]: await getEntity(infra, trackId, 'TrackSection') };
      return {};
    }
    case 'Switch': {
      const trackIDs = map((entity as SwitchEntity).properties.ports, (port) => port.track);
      return getEntities<TrackSectionEntity>(infra, trackIDs, 'TrackSection');
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
              {t('Editor.tools.select-items.linked-to-line', { count: 1 })}
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
              {t('Editor.tools.select-items.linked-to-line', { count: trackNames.length })}
            </span>{' '}
            <span>{prettifyStringsArray(trackNames, ` ${t('common.and')} `)}</span>
          </>
        );
      }
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
  const osrdConf = useSelector((state: { osrdconf: OSRDConf }) => state.osrdconf);
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
        getAdditionalEntities(osrdConf.infraID as string, entity).then((additionalEntities) => {
          setState({
            type: 'ready',
            entity,
            additionalEntities,
          });
        });
      } else {
        getEntity(osrdConf.infraID as string, id as string, objType as EditoastType).then(
          (fetchedEntity) => {
            getAdditionalEntities(osrdConf.infraID as string, fetchedEntity).then(
              (additionalEntities) => {
                setState({
                  type: 'ready',
                  entity: fetchedEntity,
                  additionalEntities,
                });
              }
            );
          }
        );
      }
    }
  }, [entity, id, objType, osrdConf.infraID, state.type]);

  if (state.type === 'loading' || state.type === 'idle')
    return (
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    );

  if (state.type === 'error')
    return (
      <div className="text-danger">
        {state.message || `An error occurred while trying to load ${objType} entity "${id}".`}
      </div>
    );

  return getSumUpContent(entity || state.entity, state.additionalEntities, t, classes, status);
};

export default EntitySumUp;
