import React, { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { flatMap, uniq } from 'lodash';
import cx from 'classnames';

import {
  BufferStopEntity,
  EditorEntity,
  SignalEntity,
  SwitchEntity,
  TrackSectionEntity,
} from '../../../types';
import { EditorContext } from '../context';
import { ExtendedEditorContextType } from '../tools/types';

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

const EntitySumUp: FC<{
  entity: EditorEntity;
  classes?: Partial<typeof DEFAULT_CLASSES>;
  status?: string;
}> = ({ entity, classes: classesOverride, status }) => {
  const { t } = useTranslation();
  const { editorState } = useContext(EditorContext) as ExtendedEditorContextType<unknown>;
  const classes = { ...DEFAULT_CLASSES, ...(classesOverride || {}) };

  let type = t(`Editor.obj-types.${entity.objType}`);
  let text = '';
  const subtexts: (string | JSX.Element)[] = [];

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
      const track = (typedEntity.properties.track &&
        editorState.entitiesIndex[typedEntity.properties.track]) as TrackSectionEntity | undefined;

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
          const track = editorState.entitiesIndex[port.track] as TrackSectionEntity | undefined;
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
        <span className={classes.strong}>{text}</span>
        {status && ` (${t(`Editor.item-statuses.${status}`)})`}
      </div>
      {subtexts.map((s, i) => (
        <div className={classes.small} key={i}>
          {s}
        </div>
      ))}
    </div>
  );
};

export default EntitySumUp;
