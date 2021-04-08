import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as allOSRDConf from 'reducers/osrdconf';
import nextId from 'react-id-generator';
import { withTranslation } from 'react-i18next';
import ProgressSNCF from 'common/BootstrapSNCF/ProgressSNCF';
import { BsLightningFill } from 'react-icons/bs';
import { WiLightning } from 'react-icons/wi';
import { MdLocalGasStation } from 'react-icons/md';
import { IoIosSpeedometer, IoMdTrain } from 'react-icons/io';
import { FaWeightHanging } from 'react-icons/fa';
import { AiOutlineColumnWidth } from 'react-icons/ai';
import { imageCompo, displayCompo } from 'applications/osrd/components/TrainCompo/Helpers';
import TrainCompoDetailsCurve from 'applications/osrd/components/TrainCompo/TrainCompoDetailsCurve';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';

const INITIAL_STATE = {
  carouselState: 'first',
  curveConfortValues: [],
  curveRestrictionsValues: [],
  curveNbEnginsValues: [],
  curveSelectedOptions: {},
  selectedCurve: undefined,
};

class TrainCompoDetails extends Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    data: PropTypes.object.isRequired,
    osrdconfActions: PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {
      carouselState: INITIAL_STATE.carouselState,
      curveConfortValues: INITIAL_STATE.curveConfortValues,
      curveRestrictionsValues: INITIAL_STATE.curveRestrictionsValues,
      curveNbEnginsValues: INITIAL_STATE.curveNbEnginsValues,
      curveSelectedOptions: INITIAL_STATE.curveSelectedOptions,
      selectedCurve: INITIAL_STATE.selectedCurve,
    };
  }

  componentDidMount = () => {
    this.updateCurves();
  }

  componentDidUpdate = (prevProps) => {
    const { data } = this.props;
    if (data.codenbengin !== prevProps.data.codenbengin) {
      this.updateCurves();
    }
  }

  updateCurves = () => {
    const { data } = this.props;

    const curveConfortValues = this.listOptionsCurves(data.basegoc, 'confort');
    const curveRestrictionsValues = this.listOptionsCurves(data.basegoc, 'restriction');
    const curveNbEnginsValues = this.listOptionsCurves(data.basegoc, 'nbengin');

    const selectedCurve = data.basegoc.filter((item) => item.confort === curveConfortValues[0]
      && item.restriction === ((curveRestrictionsValues.length > 0) ? curveRestrictionsValues[0].toString() : '')
      && item.nbengin === Number(curveNbEnginsValues[0]));

    this.setState({
      curveSelectedOptions: {
        confort: curveConfortValues[0],
        restrictions: curveRestrictionsValues[0],
        nbengins: curveNbEnginsValues[0],
      },
      curveConfortValues,
      curveRestrictionsValues,
      curveNbEnginsValues,
      selectedCurve,
    });
  }

  setTrainCompo = (imageIDX, composImages) => {
    const { osrdconfActions, data } = this.props;
    const { selectedCurve } = this.state;
    osrdconfActions.updateTrainCompo({
      ...data,
      imageIDX,
      imagesCompo: composImages,
      courbeeffortvitesse: selectedCurve[0].referencegoc.courbeeffortvitesse,
    });
  }

  changeCarouselState = () => {
    const { carouselState } = this.state;
    this.setState({ carouselState: (carouselState === 'first') ? 'second' : 'first' });
  }

  // Look after uniques values of an array of curves, depending on type
  listOptionsCurves = (data, type) => {
    const listValues = [];
    data.forEach((item) => {
      if (item[type] !== undefined) {
        listValues.push(item[type].toString());
      }
    });
    return [...new Set(listValues)];
  }

  selectCurveOnChange = (type, value) => {
    const { data } = this.props;
    const {
      curveSelectedOptions,
    } = this.state;

    curveSelectedOptions[type] = value;

    const selectedCurve = data.basegoc.filter(
      (item) => item.confort === curveSelectedOptions.confort
      && item.restriction === curveSelectedOptions.restrictions
      && item.nbengin === Number(curveSelectedOptions.nbengins),
    );

    if (selectedCurve !== undefined) {
      this.setState({
        curveSelectedOptions,
        selectedCurve,
      });
    }
  }

  formatValuesDetails = (valueName, unit = '') => {
    const { t, data } = this.props;
    if (data[valueName] !== 'NA' && data[valueName] !== '' && data[valueName] !== undefined) {
      return (
        <dl className="row traincompo-details-item">
          <dt className="col-sm-8 small font-weight-bold">{t(`osrd.trainCompo.${valueName}`)}</dt>
          <dd className="col-sm-4 small">{`${data[valueName]}${unit}`}</dd>
        </dl>
      );
    }
    return null;
  }

  render = () => {
    const { t, data } = this.props;
    const {
      carouselState,
      curveConfortValues,
      curveRestrictionsValues,
      curveNbEnginsValues,
      curveSelectedOptions,
      selectedCurve,
    } = this.state;
    const gifCompo = (data.images === undefined) ? [] : imageCompo(data);
    const dummyTractionValues = ['NA', 'D'];
    let modetraction;
    switch (data.modetraction) {
      case 'E':
      case 'Bicourant':
      case 'Tricourant':
      case 'Quadricourant':
        modetraction = (
          <>
            <span className="text-primary mx-1"><BsLightningFill /></span>
            <span className="mr-1">{t('osrd.trainCompo.electric')}</span>
            {data.tensionutilisation}
          </>
        );
        break;
      case 'D':
        modetraction = (
          <>
            <span className="text-pink mx-1"><MdLocalGasStation /></span>
            {t('osrd.trainCompo.diesel')}
          </>
        );
        break;
      case 'BiBi':
      case 'Bimode':
        modetraction = (
          <>
            <span className="text-pink ml-1"><MdLocalGasStation /></span>
            <span className="text-primary mr-1"><BsLightningFill /></span>
            <span className="mr-1">{t('osrd.trainCompo.dualMode')}</span>
            {dummyTractionValues.includes(data.tensionutilisation) ? null : data.tensionutilisation}
          </>
        );
        break;
      default:
        modetraction = data.modetraction;
        break;
    }

    return (
      <>
        <div className="traincompo-details-container mt-2">
          <div className="traincompo-details-header bg-gray text-white p-3">
            <div className="d-flex">
              <div className="traincompo-details-title">{data.enginref}</div>
              <div className="ml-auto">
                {gifCompo[0] !== undefined ? <img src={gifCompo[0].image[0]} alt="?" /> : null}
              </div>
            </div>
            <div className="traincompo-details-subtitle ml-2">
              {data.materielanalyse}
            </div>
          </div>

          <div className="mt-1 py-1 px-3 w-100 d-flex align-items-baseline">
            <small className="text-primary mr-1">ID</small>
            {data.codeengin}
            <small className="text-primary ml-2 mr-1">REF</small>
            {data.enginref}
            <small className="text-primary ml-2 mr-1">{t('osrd.trainCompo.emCount')}</small>
            {data.nbenginscalc}
            <small className="text-primary ml-2 mr-1 text-uppercase">{t('osrd.trainCompo.source')}</small>
            {data.source}
            <span className="ml-auto">
              <button
                type="button"
                className="btn btn-sm btn-only-icon btn-white traincompo-details-btn-carousel"
                onClick={this.changeCarouselState}
              >
                <span className="sr-only">More details</span>
                {t('osrd.trainCompo.specdetail')}
                {carouselState === INITIAL_STATE.carouselState
                  ? <i className="ml-2 icons-arrow-next" aria-hidden="true" />
                  : <i className="ml-2 icons-arrow-prev" aria-hidden="true" />}
              </button>
            </span>
          </div>
        </div>

        <div className="traincompo-details-carousel">
          <div className={`traincompo-details-carousel-container ${carouselState === INITIAL_STATE.carouselState ? null : 'second'}`}>
            <div className="traincompo-details-carousel-first">
              <div className="row">
                <div className="col-sm-6">
                  <div className="traincompo-details-container traincompo-details-container-specs traincompo-details-chart p-3 mt-2">
                    <div className="d-flex justify-content-between">
                      {curveConfortValues.length > 0 ? (
                        <div className="traincompo-details-chart-select">
                          <SelectSNCF
                            id="confort"
                            title={t('osrd.trainCompo.comfort')}
                            onChange={(e) => this.selectCurveOnChange('confort', e.target.value)}
                            options={curveConfortValues}
                            selectedValue={curveSelectedOptions.confort}
                          />
                        </div>
                      ) : null}
                      {curveRestrictionsValues.length > 0 ? (
                        <div className="traincompo-details-chart-select mx-2">
                          <SelectSNCF
                            id="restriction"
                            title={t('osrd.trainCompo.restrictions')}
                            onChange={(e) => this.selectCurveOnChange('restrictions', e.target.value)}
                            options={curveRestrictionsValues}
                            selectedValue={curveSelectedOptions.restrictions}
                          />
                        </div>
                      ) : null}
                      {curveNbEnginsValues.length > 0 ? (
                        <div className="traincompo-details-chart-select">
                          <SelectSNCF
                            id="nbengin"
                            title={t('osrd.trainCompo.nbengin')}
                            onChange={(e) => this.selectCurveOnChange('nbengins', e.target.value)}
                            options={curveNbEnginsValues}
                            selectedValue={curveSelectedOptions.nbengins}
                          />
                        </div>
                      ) : null}
                    </div>
                    {selectedCurve !== undefined ? (
                      <TrainCompoDetailsCurve
                        data={selectedCurve}
                      />
                    ) : (
                      <div className="text-muted text-center">
                        {t('osrd.trainCompo.noCurve')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="traincompo-details-container traincompo-details-container-specs p-3 mt-2">
                    <dl className="row">
                      <dt className="col-sm-5 small font-weight-bold">
                        <IoMdTrain />
                        <span className="ml-1">{t('osrd.trainCompo.tractionMode')}</span>
                      </dt>
                      <dd className="col-sm-7 small">{modetraction}</dd>

                      <dt className="col-sm-5 small font-weight-bold">
                        <AiOutlineColumnWidth />
                        <span className="ml-1">{t('osrd.trainCompo.size')}</span>
                      </dt>
                      <dd className="col-sm-7 small">
                        {data.longueurconvoi}
                        <small>M</small>
                      </dd>

                      <dt className="col-sm-5 small font-weight-bold">
                        <FaWeightHanging />
                        <span className="ml-1">{t('osrd.trainCompo.weight')}</span>
                      </dt>
                      <dd className="col-sm-7 small">
                        {data.etatchargevom}
                        <small>T</small>
                      </dd>

                      <dt className="col-sm-5 small font-weight-bold">
                        <IoIosSpeedometer />
                        <span className="ml-1">{t('osrd.trainCompo.maxSpeed')}</span>
                      </dt>
                      <dd className="col-sm-7 small">
                        {data.vitessmax}
                        <small>KM/H</small>
                      </dd>

                      <dt className="col-sm-5 small font-weight-bold">
                        <WiLightning />
                        <span className="ml-1">{t('osrd.trainCompo.powerClass')}</span>
                      </dt>
                      <dd className="col-sm-7 small d-flex align-items-center justify-content-between">
                        {data.classepuissance}
                        <span className="ml-2 flex-grow-1">
                          <ProgressSNCF value={data.classepuissance * 9} />
                        </span>
                      </dd>
                    </dl>
                  </div>

                  {data.source === 'CIM' ? (
                    <div className="traincompo-details-container traincompo-details-container-specs p-3 mt-2">
                      <dl className="row">
                        <dt className="col-sm-4 small font-weight-bold">{t('osrd.trainCompo.family')}</dt>
                        <dd className="col-sm-8 small">{data.famille}</dd>

                        <dt className="col-sm-4 small font-weight-bold text-muted">{`${t('osrd.trainCompo.serie')}, ${t('osrd.trainCompo.subSerie')}`}</dt>
                        <dd className="col-sm-8 small">{`${data.serie}, ${data.sousserie}`}</dd>

                        <dt className="col-sm-4 small font-weight-bold">{t('osrd.trainCompo.equipement')}</dt>
                        <dd className="col-sm-8 small">
                          {data.kvb === 'O' ? ' KVB' : null}
                          {data.mreqtvm300 === 'O' ? ' TVM300' : null}
                          {data.mreqtvm430 === 'O' ? ' TVM430' : null}
                          {data.mreqetcs1 === 'O' ? ' ERTMS1' : null}
                          {data.mreqetcs2 === 'O' ? ' ERTMS2' : null}
                          {data.mreqatp === 'O' ? ' ATP' : null}
                        </dd>

                        <dt className="col-sm-4 small font-weight-bold">{t('osrd.trainCompo.regrouping')}</dt>
                        <dd className="col-sm-8 small">{data.regroupement}</dd>
                      </dl>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="traincompo-details-carousel-second">
              <div className="row">
                <div className="col-md-6">
                  <div className="traincompo-details-container traincompo-details-container-specs x2 p-3 mt-2">
                    {this.formatValuesDetails('pmaxpantographe25000')}
                    {this.formatValuesDetails('pmaxpantographe1500')}
                    {this.formatValuesDetails('dureedemarrage', 's')}
                    {this.formatValuesDetails('accdemarrage', 'm/s²')}
                    {this.formatValuesDetails('accconfort', 'm/s²')}
                    {this.formatValuesDetails('masseadherente', 't')}
                    {this.formatValuesDetails('coeffadherence', 't')}
                    {this.formatValuesDetails('distpantographes', 'm')}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="traincompo-details-container traincompo-details-container-specs x2 p-3 mt-2">
                    {this.formatValuesDetails('distextremeportes', 'm')}
                    {this.formatValuesDetails('distnezpremporte', 'm')}
                    {this.formatValuesDetails('nombreporteaccesvoy')}
                    {this.formatValuesDetails('largeurportesaccesvoy', 'm')}
                    {this.formatValuesDetails('dureeminouvportes', 's')}
                    {this.formatValuesDetails('dureeminfermportes', 's')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="traincompo-details-container traincompo-details-compos p-3 mt-2">
          {gifCompo.length > 0
            ? <h2>{`${gifCompo.length} ${t('osrd.trainCompo.displayFound')}`}</h2>
            : <h2>{t('osrd.trainCompo.noDisplayFound')}</h2>}
          {gifCompo[0] !== undefined ? (
            gifCompo.map((compo, index) => (
              <div
                className={compo.image.length > 1 ? 'traincompo-details-compo' : 'traincompo-details-compo d-flex align-items-center'}
                key={nextId()}
                onClick={() => this.setTrainCompo(index, compo.image)}
                role="button"
                tabIndex={0}
                data-dismiss="modal"
              >
                <div className="traincompo-details-compo-img">
                  <div className="traincompo-details-compo-img-scale">
                    {displayCompo(compo.image)}
                  </div>
                </div>
                <div className="traincompo-details-compo-comment">{compo.commentaire}</div>
              </div>
            ))
          ) : null}
        </div>
      </>
    );
  }
}
const mapStateToProps = (state) => ({
  osrdconf: state.osrdconf,
});

const mapDispatchToProps = (dispatch) => ({
  osrdconfActions: bindActionCreators(allOSRDConf, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(TrainCompoDetails));
