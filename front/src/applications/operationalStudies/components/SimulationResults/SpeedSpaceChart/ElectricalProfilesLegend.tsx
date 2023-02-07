import React from 'react';

interface Props {
  isActive: boolean;
  setIsActive: Function;
}

interface Profile {
  mode: string;
  color: string[];
  isStriped: boolean;
}

const legend: Profile[] = [
  { mode: '25000V', color: ['25KA', '25KB'], isStriped: false },
  { mode: '1500V', color: ['1500A', '1500B', '1500C'], isStriped: false },
  { mode: 'Thermique', color: ['Thermal'], isStriped: false },
  { mode: '15000V 16/2/3', color: ['15000'], isStriped: false },
  { mode: '3000V', color: ['3000'], isStriped: false },
  { mode: 'Non utilisé', color: ['noUsed'], isStriped: true },
];

export const ElectricalProfilesLegend = ({ isActive, setIsActive }: Props) => (
  <div className={`elecProf-modal elecProf-modal-dark`}>
    <div className="d-flex justify-content-between align-items-start">
      <span className="h2 text-light">Légende</span>
      <button type="button" className="close" onClick={() => setIsActive(!isActive)}>
        ×
      </button>
    </div>
    <div className="row">
      <div className="col-lg-12">
        <div className="elecProfKey">
          {legend.map((profile) => (
            <div className="elecProfKey-item">
              <div className="elecProfKey-icon">
                {profile.color.map((color) => (
                  <i
                    className={
                      profile.isStriped
                        ? `elecProfKey-stripedBlock elecProfKey-${color}`
                        : `elecProfKey-line elecProfKey-${color}`
                    }
                  />
                ))}
              </div>
              <span className="elecProfKey-text">{profile.mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
