import React, { useMemo, useRef, useState } from 'react';

import cx from 'classnames';
import { AiOutlineColumnWidth } from 'react-icons/ai';
import { BsLightningFill } from 'react-icons/bs';
import { FaWeightHanging } from 'react-icons/fa';
import { GoContainer } from 'react-icons/go';
import { IoIosSpeedometer } from 'react-icons/io';
import { MdLocalGasStation } from 'react-icons/md';

import type { Comfort, LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockInfo } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';

import RollingStockCardButtons from './RollingStockCardButtons';
import RollingStockCardDetail from './RollingStockCardDetail';

interface RollingStockCardProps {
  isOpen: boolean;
  isOnEditMode?: boolean;
  noCardSelected: boolean;
  ref2scroll?: React.MutableRefObject<HTMLDivElement | null>;
  rollingStock: LightRollingStockWithLiveries;
  setOpenedRollingStockCardId: (openCardId: number | undefined) => void;
}

const RollingStockCard = ({
  isOpen,
  isOnEditMode = false,
  noCardSelected,
  rollingStock,
  ref2scroll = undefined,
  setOpenedRollingStockCardId,
}: RollingStockCardProps) => {
  const [curvesComfortList, setCurvesComfortList] = useState<Comfort[]>([]);

  const ref2scrollWhenOpened: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);

  const tractionModes = useMemo(() => {
    const localModes = {
      electric: false,
      thermal: false,
      voltages: [],
    };
    const localVoltages: string[] = [];
    Object.keys(rollingStock.effort_curves.modes).forEach((modeName) => {
      if (rollingStock.effort_curves.modes[modeName].is_electric) {
        localModes.electric = true;
        localVoltages.push(modeName);
      } else {
        localModes.thermal = true;
      }
    });
    return { ...localModes, voltages: localVoltages };
  }, [rollingStock.effort_curves.modes]);

  function displayCardDetail() {
    if (!isOpen) {
      setOpenedRollingStockCardId(rollingStock.id);
      setTimeout(() => ref2scrollWhenOpened.current?.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }

  return (
    <div
      className={cx('rollingstock-card', {
        active: isOpen,
        inactive: !isOpen,
        solid: noCardSelected,
      })}
      role="button"
      onClick={displayCardDetail}
      tabIndex={0}
      ref={ref2scroll}
      data-testid={`rollingstock-${rollingStock.name}`}
    >
      <div
        className="rollingstock-card-header"
        onClick={() => {
          if (isOpen) setOpenedRollingStockCardId(undefined);
        }}
        role="button"
        tabIndex={0}
        ref={isOpen && !isOnEditMode ? ref2scrollWhenOpened : undefined}
      >
        <div className="rollingstock-title">
          <RollingStockInfo rollingStock={rollingStock} />
          <div className="sr-only">
            <small className="text-primary mr-1">ID</small>
            <span className="font-weight-lighter small">{rollingStock.id}</span>
          </div>
        </div>
      </div>
      {isOpen && !isOnEditMode ? (
        <RollingStockCardDetail
          id={rollingStock.id}
          curvesComfortList={curvesComfortList}
          setCurvesComfortList={setCurvesComfortList}
        />
      ) : (
        <div
          className={cx('rollingstock-body-container-img', {
            'opened-rollingstock-card-body': isOpen,
          })}
        >
          <div className="rollingstock-body-img">
            <RollingStock2Img rollingStock={rollingStock} />
          </div>
        </div>
      )}
      <div className="rollingstock-footer">
        <div className="rollingstock-footer-specs">
          <div className="row">
            <div className="col-5">
              <div className="rollingstock-tractionmode text-nowrap">
                {rollingStock.freight_compatible && (
                  <span className="text-black">
                    <GoContainer />
                  </span>
                )}
                {tractionModes.thermal && (
                  <span className="text-pink">
                    <MdLocalGasStation />
                  </span>
                )}
                {tractionModes.electric && (
                  <>
                    <span className="text-primary">
                      <BsLightningFill />
                    </span>
                    <small>
                      {tractionModes.voltages.map((voltage) => (
                        <span className="mr-1" key={`${voltage}${rollingStock.id}`}>
                          {voltage}
                        </span>
                      ))}
                    </small>
                  </>
                )}
              </div>
            </div>
            <div className="col-2">
              <div className="rollingstock-size text-nowrap">
                <AiOutlineColumnWidth />
                {rollingStock.length}m
              </div>
            </div>
            <div className="col-2">
              <div className="rollingstock-weight text-nowrap">
                <FaWeightHanging />
                {Math.round(rollingStock.mass / 1000)}t
              </div>
            </div>
            <div className="col-3">
              <div className="rollingstock-speed text-nowrap">
                <IoIosSpeedometer />
                {Math.round(rollingStock.max_speed * 3.6)}km/h
              </div>
            </div>
          </div>
        </div>
        {isOpen && curvesComfortList && !isOnEditMode && (
          <RollingStockCardButtons
            id={rollingStock.id}
            curvesComfortList={curvesComfortList}
            setOpenedRollingStockCardId={setOpenedRollingStockCardId}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(RollingStockCard);
