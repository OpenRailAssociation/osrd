import React from 'react';
import { useTranslation } from 'react-i18next';
import { ElecProfileProps, legend } from 'applications/operationalStudies/consts';

const ElectricalProfilesLegend = ({ isActive, setIsActive }: ElecProfileProps) => {
  const { t } = useTranslation('simulation');

  return (
    <div className="elecProf-modal elecProf-modal-dark">
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
