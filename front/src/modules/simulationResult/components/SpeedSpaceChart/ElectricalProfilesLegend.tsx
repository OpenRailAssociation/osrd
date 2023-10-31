import React from 'react';
import { useTranslation } from 'react-i18next';
import { legend } from 'applications/operationalStudies/consts';

interface ElecProfileProps {
  isActive: boolean;
  setIsActive: (isActive: boolean) => void;
}

const ElectricalProfilesLegend = ({ isActive, setIsActive }: ElecProfileProps) => {
  const { t } = useTranslation('simulation');

  return (
    <div className="electrical-profile-legend-modal">
      <div className="d-flex justify-content-between align-items-start">
        <span className="h2 text-light">{t('electricalProfiles.legend')}</span>
        <button type="button" className="close" onClick={() => setIsActive(!isActive)}>
          ×
        </button>
      </div>
      <div className="row">
        <div className="elecProfKey">
          {legend.map((profile) => (
            <div className="elecProfKey-item" key={profile.mode}>
              <div className="elecProfKey-icon">
                {profile.color.map((color) => (
                  <i
                    className={
                      profile.isStriped
                        ? `elecProfKey-stripedBlock elecProfKey-${color}`
                        : `elecProfKey-line elecProfKey-${color}`
                    }
                    key={color}
                  />
                ))}
              </div>
              <span className="elecProfKey-text">{t(`electricalProfiles.${profile.mode}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ElectricalProfilesLegend;
