import React, { type SetStateAction } from 'react';

import { Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { PathStep } from 'reducers/osrdconf/types';

import type { FeatureInfoClick } from '../types';

type OperationalPointPopupDetailsProps = {
  operationalPoint: FeatureInfoClick;
  clickedOp: PathStep & {
    tracks: {
      trackName?: string;
      coordinates?: number[];
    }[];
  };
  selectedTrack: {
    trackName?: string;
    coordinates?: number[];
  };
  setSelectedTrack: React.Dispatch<
    SetStateAction<{ trackName?: string; coordinates?: number[] } | undefined>
  >;
};

const OperationalPointPopupDetails = ({
  operationalPoint,
  clickedOp,
  selectedTrack,
  setSelectedTrack,
}: OperationalPointPopupDetailsProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  return (
    <>
      <div className="details">
        <div className="details-track">
          {operationalPoint.feature.properties!.extensions_sncf_track_name}
          <small>{operationalPoint.feature.properties!.extensions_sncf_line_code}</small>
        </div>
        <div className="details-line">
          {operationalPoint.feature.properties!.extensions_identifier_name} <br />
          {operationalPoint.feature.properties!.extensions_sncf_trigram}{' '}
          {operationalPoint.feature.properties!.extensions_sncf_ch}
        </div>
      </div>
      <Select
        getOptionLabel={(option) => option?.trackName || t('anyTrack')}
        getOptionValue={(option) => option?.trackName || ''}
        id="select-track"
        onChange={(selectedOption) => setSelectedTrack(selectedOption)}
        options={clickedOp.tracks}
        value={selectedTrack}
      />
    </>
  );
};

export default OperationalPointPopupDetails;
