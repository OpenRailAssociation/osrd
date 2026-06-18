import { OccurrenceAll, OccurrenceCompliant, OccurrenceSingle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

export type PanelSelectionMode = 'compliant' | 'all' | 'single';

export const PANEL_SELECTION_MODES: PanelSelectionMode[] = ['compliant', 'all', 'single'];

type CurveSelectionSidePanelProps = {
  position: number;
  panelSelectionMode: PanelSelectionMode;
  onModeChange: (mode: PanelSelectionMode) => void;
  counts: { compliant: number; all: number };
};

const CurveSelectionSidePanel = ({
  position,
  panelSelectionMode,
  onModeChange,
  counts,
}: CurveSelectionSidePanelProps) => {
  const { t } = useTranslation('operational-studies');

  const formattedOccurrences: {
    mode: PanelSelectionMode;
    value: number;
    icon: React.ReactNode;
    isActive: boolean;
  }[] = [
    {
      mode: 'compliant',
      value: counts.compliant,
      icon: <OccurrenceCompliant />,
      isActive: panelSelectionMode === 'compliant',
    },
    {
      mode: 'all',
      value: counts.all,
      icon: <OccurrenceAll />,
      isActive: panelSelectionMode === 'all',
    },
    {
      mode: 'single',
      value: 0,
      icon: <OccurrenceSingle />,
      isActive: panelSelectionMode === 'single',
    },
  ];

  return (
    <div className="curve-selection-side-panel" style={{ top: position }}>
      {formattedOccurrences.map(({ mode, value, icon, isActive }) => {
        const title = t(`simulationResults.curveSelection.${mode}`, {
          count: value,
        });

        return (
          <button
            key={mode}
            type="button"
            className={cx('numbered-icon', { 'selected-icon': isActive })}
            title={title}
            aria-label={title}
            onClick={() => onModeChange(mode)}
          >
            <span className="curve-selection-icon" aria-hidden>
              {icon}
            </span>
            {value > 0 && <span className="occurrences-number">{value}</span>}
            {isActive && <div className="selection-marker" />}
          </button>
        );
      })}
    </div>
  );
};

export default CurveSelectionSidePanel;
