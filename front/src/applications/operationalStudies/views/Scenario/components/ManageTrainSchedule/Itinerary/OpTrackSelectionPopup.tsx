import { useCallback, useMemo, useState } from 'react';

import { Button, Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { Popup } from 'react-map-gl/maplibre';

import type { OperationalPointReference, PathItemLocation } from 'common/api/osrdEditoastApi';

export type PendingOpClick = {
  coordinates: number[];
  opRef: OperationalPointReference;
  parts: Array<{ local_track_name: string }>;
  clickedTrackName: string | null;
  displayName: string;
};

type TrackOption = { local_track_name: string | null };

type OpTrackSelectionPopupProps = {
  pendingOpClick: PendingOpClick;
  onCancel: () => void;
  onConfirm: (location: PathItemLocation) => void;
};

const OpTrackSelectionPopup = ({
  pendingOpClick,
  onCancel,
  onConfirm,
}: OpTrackSelectionPopupProps) => {
  const [selectedTrackName, setSelectedTrackName] = useState<string | null>(
    pendingOpClick.clickedTrackName
  );
  const { t: tItinerary } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });
  const { t: tManage } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule',
  });

  const trackOptions = useMemo<TrackOption[]>(
    () => [
      { local_track_name: null },
      ...pendingOpClick.parts.map((p) => ({ local_track_name: p.local_track_name })),
    ],
    [pendingOpClick.parts]
  );

  const selectedOption =
    trackOptions.find((o) => o.local_track_name === selectedTrackName) ?? trackOptions[0];

  const focusSelectOnMount = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.querySelector<HTMLElement>('input, select, button')?.focus();
    }
  }, []);

  return (
    <Popup
      longitude={pendingOpClick.coordinates[0]}
      latitude={pendingOpClick.coordinates[1]}
      closeButton={false}
      closeOnClick={false}
      className="op-track-selection-popup"
    >
      <div className="op-track-selection-popup-content">
        <div className="op-track-selection-body" ref={focusSelectOnMount}>
          <Select
            id="op-track-select"
            label={tItinerary('track')}
            getOptionLabel={(option) => option.local_track_name ?? tManage('anyTrack')}
            getOptionValue={(option) => option.local_track_name ?? ''}
            options={trackOptions}
            value={selectedOption}
            onChange={(option) => setSelectedTrackName(option?.local_track_name ?? null)}
          />
        </div>
        <div className="op-track-selection-actions">
          <Button
            label={tItinerary('cancelMapSelection')}
            variant="Cancel"
            size="small"
            onClick={onCancel}
          />
          <Button
            label={tItinerary('addPoint')}
            variant="Primary"
            size="small"
            onClick={() =>
              onConfirm({
                type: 'operational_point_part_reference',
                operational_point: pendingOpClick.opRef,
                local_track_name: selectedTrackName ?? undefined,
              })
            }
          />
        </div>
      </div>
    </Popup>
  );
};

export default OpTrackSelectionPopup;
