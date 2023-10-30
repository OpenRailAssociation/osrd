import React from 'react';
import { TFunction } from 'i18next';
import { PSLSign } from 'types';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { FaTrash } from 'react-icons/fa';
import { isNil } from 'lodash';
import { RiDragMoveLine } from 'react-icons/ri';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { PSL_SIGN_TYPES, PslSignInformation } from '../types';

const PslSignCard = ({
  sign,
  signInfo,
  t,
  removeSign,
  selectSign,
  updateSign,
}: {
  sign: PSLSign;
  signInfo: PslSignInformation;
  t: TFunction;
  removeSign?: (signInfo: Exclude<PslSignInformation, { signType: PSL_SIGN_TYPES.Z }>) => void;
  selectSign: (signInfo: PslSignInformation) => void;
  updateSign: (signInfo: PslSignInformation, sign: PSLSign) => void;
}) => {
  const { signType } = signInfo;
  const roundedPosition = Math.round(sign.position);
  return (
    <>
      {signType === PSL_SIGN_TYPES.Z && (
        <h4 className="mt-4">
          {t('Editor.tools.speed-edition.sign-category', {
            signType,
          }).toString()}
        </h4>
      )}
      <div className="my-4 py-2 px-2" style={{ backgroundColor: 'white' }}>
        <InputSNCF
          type="number"
          id="psl-angle-geo"
          label={t('Editor.tools.speed-edition.sign-angle-geo')}
          value={!isNil(sign.angle_geo) ? sign.angle_geo : 0}
          onChange={(e) =>
            updateSign(signInfo, {
              ...sign,
              angle_geo: Number(e.target.value),
            })
          }
          sm
        />
        <div className="my-2">
          <InputSNCF
            type="number"
            id="psl-angle-sch"
            label={t('Editor.tools.speed-edition.sign-angle-sch')}
            value={!isNil(sign.angle_sch) ? sign.angle_sch : 0}
            onChange={(e) =>
              updateSign(signInfo, {
                ...sign,
                angle_sch: Number(e.target.value),
              })
            }
            sm
          />
        </div>
        <div className="my-2">
          <InputSNCF
            type="text"
            id="track-id"
            label={t('Editor.tools.speed-edition.sign-track-id')}
            value={!isNil(sign.track) ? sign.track : 0}
            onChange={(e) =>
              updateSign(signInfo, {
                ...sign,
                track: String(e.target.value),
              })
            }
            sm
          />
        </div>
        <div className="my-2">
          <InputSNCF
            type="number"
            id="psl-position-from-the-beginning"
            label={t('Editor.tools.speed-edition.sign-position')}
            value={roundedPosition}
            onChange={(e) => {
              const newPosition = Number(e.target.value);
              const updatedPosition = newPosition >= 0 ? newPosition : 0;
              updateSign(signInfo, {
                ...sign,
                position: updatedPosition,
              });
            }}
            sm
          />
        </div>
        {signType === PSL_SIGN_TYPES.ANNOUNCEMENT && (
          <>
            <div className="my-2">
              <InputSNCF
                type="number"
                id="psl-value"
                label={t('Editor.tools.speed-edition.sign-value')}
                value={sign.value ? sign.value : ''}
                onChange={(e) =>
                  updateSign(signInfo, {
                    ...sign,
                    value: e.target.value,
                  })
                }
                sm
              />
            </div>
            <div className="my-2">
              <SelectImprovedSNCF
                sm
                label={t('Editor.tools.speed-edition.sign-type').toString()}
                options={['TIV_B', 'TIV_D']}
                value={sign.type}
                onChange={() =>
                  updateSign(signInfo, {
                    ...sign,
                    type: sign.type === 'TIV_B' ? 'TIV_D' : 'TIV_B',
                  })
                }
              />
            </div>
          </>
        )}
        <div className="my-2">
          <SelectImprovedSNCF
            label={t('Editor.tools.speed-edition.sign-side').toString()}
            sm
            options={['LEFT', 'RIGHT', 'CENTER']}
            onChange={(selectedValue) => {
              if (selectedValue) updateSign(signInfo, { ...sign, side: selectedValue });
            }}
            value={sign.side}
          />
        </div>
        <div className="mt-2">
          <span>{t('Editor.tools.speed-edition.sign-select').toString()}</span>
          <button
            type="button"
            className="btn btn-sm px-2 ml-2"
            onClick={() => selectSign(signInfo)}
          >
            <RiDragMoveLine />
          </button>
        </div>
        {signType !== PSL_SIGN_TYPES.Z && removeSign && (
          <div className="mt-2">
            <span>{t('Editor.tools.speed-edition.sign-remove').toString()}</span>
            <button
              type="button"
              className="btn btn-danger btn-sm px-2 ml-2"
              onClick={() =>
                removeSign(signInfo as Exclude<PslSignInformation, { signType: PSL_SIGN_TYPES.Z }>)
              }
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default PslSignCard;
