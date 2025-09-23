import { ComboBox, Select } from '@osrd-project/ui-core';
import { AddLocation, FocusLocation } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { PathStepV2 } from 'reducers/osrdconf/types';

type PathStepProps = {
  pathStep?: PathStepV2;
  index?: number;
  hidePathfindingLine?: boolean;
};

const PathStepItem = ({ pathStep, index, hidePathfindingLine }: PathStepProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });

  return (
    <div className="path-step-wrapper">
      <div className="path-step">
        <div
          className={cx('path-step-counter', {
            index,
            'pathfinding-line': !hidePathfindingLine,
            origin: index === 1,
            empty: !pathStep,
          })}
        >
          {index}
        </div>
        <div className="path-step-op-name">
          <ComboBox
            id={`pathStep-name-${pathStep?.id ?? 'empty'}`}
            value={''}
            suggestions={[]}
            getSuggestionLabel={(option) => String(option)}
            onSelectSuggestion={() => {}}
            resetSuggestions={() => {}}
            small
            narrow
            readOnly
          />
        </div>
        <Select
          id={`pathStep-type-${pathStep?.id ?? 'empty'}`}
          options={[]}
          getOptionLabel={(option) => String(option)}
          getOptionValue={(option) => String(option)}
          onChange={() => {}}
          small
          narrow
          readOnly
        />
        <Select
          id={`pathStep-status-${pathStep?.id ?? 'empty'}`}
          options={[]}
          getOptionLabel={(option) => String(option)}
          getOptionValue={(option) => String(option)}
          onChange={() => {}}
          small
          narrow
          readOnly
        />
        <div className="map-interactions">
          <AddLocation size="lg" title={t('addLocationOnMap')} aria-label={t('addLocationOnMap')} />
          <FocusLocation
            size="lg"
            className={cx('focus-map-icon', { empty: !pathStep })}
            title={t('focusLocationOnMap')}
            aria-label={t('focusLocationOnMap')}
          />
        </div>
      </div>
    </div>
  );
};

export default PathStepItem;
