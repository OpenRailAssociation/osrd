import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import { IoIosSpeedometer } from 'react-icons/io';
import { FaWeightHanging } from 'react-icons/fa';
import { AiOutlineColumnWidth } from 'react-icons/ai';
import { LazyLoadComponent } from 'react-lazy-load-image-component';
import RollingStockCardDetail from './RollingStockCardDetail';
import RollingStock2Img from './RollingStock2Img';
import { RollingStockInfos } from './RollingStockHelpers';
import RollingStockCardButtons from './RollingStockCardButtons';

function RollingStockCard(props) {
  const [tractionModes, setTractionModes] = useState({
    electric: false,
    thermal: false,
    voltages: [],
  });
  const [curvesComfortList, setCurvesComfortList] = useState();
  const { data, ref2scroll, setOpenedRollingStockCardId, isOpen, noCardSelected } = props;
  const ref2scrollWhenOpened = useRef();

  function displayCardDetail() {
    if (!isOpen) {
      setOpenedRollingStockCardId(data.id);
      setTimeout(() => ref2scrollWhenOpened.current?.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }

  useEffect(() => {
    if (typeof data.effort_curves.modes === 'object') {
      const localVoltages = {};
      const localModes = {};
      Object.keys(data.effort_curves.modes).forEach((modeName) => {
        if (data.effort_curves.modes[modeName].is_electric) {
          localModes.electric = true;
          localVoltages[modeName] = true;
        } else {
          localModes.thermal = true;
        }
      });
      setTractionModes({ ...localModes, voltages: Object.keys(localVoltages) });
    }
    // Has to be run only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`rollingstock-container mb-3 ${isOpen ? 'active' : 'inactive'} ${
        noCardSelected ? 'solid' : ''
      }`}
      role="button"
      onClick={displayCardDetail}
      tabIndex={0}
      ref={ref2scroll}
    >
      <div
        className="rollingstock-header"
        onClick={() => (isOpen ? setOpenedRollingStockCardId(undefined) : {})}
        role="button"
        tabIndex={0}
        ref={isOpen ? ref2scrollWhenOpened : undefined}
      >
        <div className="rollingstock-title">
          <RollingStockInfos data={data} />
          <div className="sr-only">
            <small className="text-primary mr-1">ID</small>
            <span className="font-weight-lighter small">{data.id}</span>
          </div>
        </div>
      </div>
      {isOpen ? (
        <RollingStockCardDetail
          id={data.id}
          curvesComfortList={curvesComfortList}
          setCurvesComfortList={setCurvesComfortList}
        />
      ) : (
        <LazyLoadComponent>
          <div className="rollingstock-body-container-img">
            <div className="rollingstock-body-img">
              <RollingStock2Img rollingStock={data} />
            </div>
          </div>
        </LazyLoadComponent>
      )}
      <div className="rollingstock-footer">
        <div className="rollingstock-footer-specs">
          <div className="row">
            <div className="col-5">
              <div className="rollingstock-tractionmode text-nowrap">
                {tractionModes.thermal ? (
                  <span className="text-pink">
                    <MdLocalGasStation />
                  </span>
                ) : null}
                {tractionModes.electric ? (
                  <>
                    <span className="text-primary">
                      <BsLightningFill />
                    </span>
                    <small>
                      {tractionModes.voltages.map((voltage) => (
                        <span className="mr-1" key={`${voltage}${data.id}`}>
                          {voltage}V
                        </span>
                      ))}
                    </small>
                  </>
                ) : null}
              </div>
            </div>
            <div className="col-2">
              <div className="rollingstock-size text-nowrap">
                <AiOutlineColumnWidth />
                {data.length}
                <small>M</small>
              </div>
            </div>
            <div className="col-2">
              <div className="rollingstock-weight text-nowrap">
                <FaWeightHanging />
                {Math.round(data.mass / 1000)}
                <small>T</small>
              </div>
            </div>
            <div className="col-3">
              <div className="rollingstock-speed text-nowrap">
                <IoIosSpeedometer />
                {Math.round(data.max_speed * 3.6)}
                <small>KM/H</small>
              </div>
            </div>
          </div>
        </div>
        {isOpen && curvesComfortList ? (
          <RollingStockCardButtons
            id={data.id}
            curvesComfortList={curvesComfortList}
            setOpenedRollingStockCardId={setOpenedRollingStockCardId}
          />
        ) : null}
      </div>
    </div>
  );
}

RollingStockCard.defaultProps = {
  ref2scroll: undefined,
};

RollingStockCard.propTypes = {
  data: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  setOpenedRollingStockCardId: PropTypes.func.isRequired,
  ref2scroll: PropTypes.object,
  noCardSelected: PropTypes.bool.isRequired,
};

const MemoizedRollingStockCard = React.memo(RollingStockCard);
export default MemoizedRollingStockCard;
