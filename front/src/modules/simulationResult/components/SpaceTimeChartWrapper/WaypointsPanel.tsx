import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Checkbox } from '@osrd-project/ui-core';
import { Alert } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { PathOperationalPoint, WaypointsPanelData } from 'modules/simulationResult/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import { mmToKm } from 'utils/physics';

import { getWaypointsLocalStorageKey } from './helpers/utils';

type WaypointsPanelProps = {
  waypointsPanelIsOpen: boolean;
  setWaypointsPanelIsOpen: (open: boolean) => void;
  waypoints: PathOperationalPoint[];
  waypointsPanelData: WaypointsPanelData;
};

const WaypointsPanel = ({
  waypointsPanelIsOpen,
  setWaypointsPanelIsOpen,
  waypoints,
  waypointsPanelData: { filteredWaypoints, setFilteredWaypoints, projectionPath, timetableId },
}: WaypointsPanelProps) => {
  const { t } = useTranslation();

  const modalRef = useRef<HTMLDialogElement>(null);

  const [selectedWaypoints, setSelectedWaypoints] = useState<Set<number>>(
    new Set(filteredWaypoints.map((_, i) => i))
  );
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>();
  const [isNotEnoughSelectedWaypoints, setIsNotEnoughSelectedWaypoints] = useState(false);

  const allWaypointsSelected = useMemo(
    () => selectedWaypoints.size === waypoints.length,
    [selectedWaypoints, waypoints]
  );

  const isIndeterminate = useMemo(
    () => selectedWaypoints.size > 0 && !allWaypointsSelected,
    [selectedWaypoints, allWaypointsSelected]
  );

  const openModal = () => {
    modalRef.current?.showModal();
    const filteredWaypointsIds = new Set(filteredWaypoints.map((waypoint) => waypoint.waypointId));
    const filteredWaypointsIndexes = waypoints
      .map((waypoint, index) => (filteredWaypointsIds.has(waypoint.waypointId) ? index : -1))
      .filter((index) => index !== -1);

    setSelectedWaypoints(new Set(filteredWaypointsIndexes));
  };

  const closeModal = () => {
    modalRef.current?.close();
    setWaypointsPanelIsOpen(false);
  };

  useModalFocusTrap(modalRef, closeModal);

  const handleSubmit = () => {
    if (selectedWaypoints.size < 2) {
      setIsNotEnoughSelectedWaypoints(true);
      return;
    }
    const newFilteredWaypoints = waypoints.filter((_, i) => selectedWaypoints.has(i));
    setFilteredWaypoints(newFilteredWaypoints);

    // TODO : when switching to the manchette back-end manager, remove all logic using
    // cleanScenarioLocalStorage from projet/study/scenario components (single/multi select)
    localStorage.setItem(
      getWaypointsLocalStorageKey(timetableId, projectionPath),
      JSON.stringify(newFilteredWaypoints)
    );

    closeModal();
  };

  useEffect(() => {
    if (waypointsPanelIsOpen) {
      openModal();
    }
  }, [waypointsPanelIsOpen]);

  // TODO : fix checkbox component in osrd-ui to handle shift + click because of a firefox bug (#510)
  const handleWaypointClick = (event: React.MouseEvent<HTMLInputElement>, index: number) => {
    event.stopPropagation();
    const newSet = new Set(selectedWaypoints);
    if (event.shiftKey && lastSelectedIndex !== undefined) {
      const minIndex = Math.min(index, lastSelectedIndex);
      const maxIndex = Math.max(index, lastSelectedIndex);

      // If the lastSelectedIndex has been checked, we check all waypoints of the range
      // If it has been unchecked, we uncheck all waypoints of the range
      if (newSet.has(lastSelectedIndex)) {
        for (let i = minIndex; i <= maxIndex; i += 1) {
          newSet.add(i);
        }
      } else {
        for (let i = minIndex; i <= maxIndex; i += 1) {
          newSet.delete(i);
        }
      }
    } else if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }

    setSelectedWaypoints(newSet);
    setLastSelectedIndex(index);
  };

  const handleMultiCheckboxClick = () => {
    if (!allWaypointsSelected) {
      setSelectedWaypoints(new Set(waypoints.map((_, i) => i)));
    }
    if (allWaypointsSelected) {
      setSelectedWaypoints(new Set());
    }
  };

  return (
    <dialog data-testid="waypoints-panel-dialog" ref={modalRef} className={cx('waypoints-panel')}>
      <div className="waypoints-panel-header">
        <div className="name">{t('operational-studies:simulationResults.waypointsPanel.name')}</div>
        <div className="secondary-code">
          {t('operational-studies:simulationResults.waypointsPanel.secondaryCode')}
        </div>
      </div>
      <div
        className={cx('waypoints-panel-body', {
          'with-warning': selectedWaypoints.size < 2,
        })}
      >
        <div className="waypoint-item selector-all" data-testid="waypoints-panel-select-all">
          <Checkbox
            small
            isIndeterminate={isIndeterminate}
            checked={allWaypointsSelected}
            onChange={handleMultiCheckboxClick}
          />
        </div>
        {waypoints.map((waypoint, index) => (
          <div className="waypoint-item" key={waypoint.waypointId} data-testid="waypoint-item">
            <Checkbox
              small
              checked={selectedWaypoints.has(index)}
              // onChange needs to be there to avoid a warning in console but the event doesn't provide
              // an event listening for shift click so we have to use onClick anyway
              onChange={() => {}}
              onClick={(e) => {
                handleWaypointClick(e, index);
              }}
            />
            <span data-testid="waypoint-point-offset" className="path-offset">
              {/* If an offset ends with .00, we want do display only one 0 */}
              {mmToKm(waypoint.position) % 1 === 0
                ? mmToKm(waypoint.position).toFixed(1)
                : mmToKm(waypoint.position).toFixed(2)}
            </span>
            <span className="name" data-testid="waypoint-name">
              {waypoint.extensions?.identifier?.name}
            </span>
            <span className="ch" data-testid="waypoint-ch">
              {waypoint.extensions?.sncf?.ch}
            </span>
          </div>
        ))}
      </div>
      <div
        data-testid="waypoints-panel-footer"
        className={cx('waypoints-panel-footer', {
          'wizz-effect': isNotEnoughSelectedWaypoints,
        })}
      >
        <Button label={t('common.cancel')} variant="Cancel" onClick={closeModal} />
        <Button label={t('common.validate')} variant="Primary" onClick={handleSubmit} />
        {selectedWaypoints.size < 2 && (
          <div className="warning-message">
            <Alert variant="fill" iconColor="#EAA72B" size="lg" />
            <span className="text-center">
              {t('operational-studies:simulationResults.waypointsPanel.warning')}
            </span>
          </div>
        )}
      </div>
    </dialog>
  );
};

export default WaypointsPanel;
