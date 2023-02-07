import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isActive: boolean;
  setIsActive: Function;
}

interface Profile {
  mode: string;
  color: string[];
  isStriped: boolean;
}

export const ElectricalProfilesLegend = ({ isActive, setIsActive }: Props) => {
  const { t } = useTranslation('simulation');

  const legend: Profile[] = [
    { mode: '25000V', color: ['25KA', '25KB'], isStriped: false },
    { mode: '1500V', color: ['1500A', '1500B', '1500C'], isStriped: false },
    { mode: t('electricalProfiles.thermal'), color: ['Thermal'], isStriped: false },
    { mode: '15000V 16/2/3', color: ['15000'], isStriped: false },
    { mode: '3000V', color: ['3000'], isStriped: false },
    { mode: t('electricalProfiles.unused'), color: ['noUsed'], isStriped: true },
  ];

  return (
    <div className={`elecProf-modal elecProf-modal-dark`}>
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
              <span className="elecProfKey-text">{profile.mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
