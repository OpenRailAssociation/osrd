import React from 'react';
import PropTypes from 'prop-types';
import Loader from 'common/Loader';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as allTrainCompoActions from 'reducers/traincompo';
import { withTranslation } from 'react-i18next';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import TrainCompoCard from 'applications/osrd/components/TrainCompo/TrainCompoCard';
import TrainCompoDetails from 'applications/osrd/components/TrainCompo/TrainCompoDetails';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import 'applications/osrd/components/TrainCompo/TrainCompo.scss';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

class TrainCompo extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    traincompo: PropTypes.object.isRequired,
    traincompoActions: PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props);
    const { traincompo } = this.props;

    this.state = {
      resultContent: traincompo.materiel.results,
      detailsContent: undefined,
      filters: {
        text: '',
        thor: true,
        cim: true,
        elec: true,
        diesel: true,
        sort: true, // true for ASC, false for DESC
      },
      isFiltering: false,
    };
  }

  componentDidMount = async () => {
    const { traincompo, traincompoActions } = this.props;
    if (traincompo.materiel.results === undefined) {
      const data = await traincompoActions.getMateriel();
      this.setState({ resultContent: data.results });
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    const { filters } = this.state;
    if (filters !== prevState.filters) {
      this.updateSearch();
    }
  }

  searchMateriel = (e) => {
    const { filters } = this.state;
    this.setState({
      filters: { ...filters, text: e.target.value.toLowerCase() },
      isFiltering: true,
    });
  }

  updateSearch = () => {
    const { traincompo } = this.props;
    const { filters } = this.state;

    // Text filter
    let resultContent = traincompo.materiel.results.filter(
      (el) => el.enginref.toLowerCase().includes(filters.text)
        || el.materielanalyse.toLowerCase().includes(filters.text)
        || el.codeengin.toLowerCase().includes(filters.text),
    );

    // checkbox filters
    if (!filters.thor) {
      resultContent = resultContent.filter((el) => el.source !== 'THOR');
    }
    if (!filters.cim) {
      resultContent = resultContent.filter((el) => el.source !== 'CIM');
    }
    if (!filters.elec) {
      resultContent = resultContent.filter((el) => el.modetraction !== 'E');
    }
    if (!filters.diesel) {
      resultContent = resultContent.filter((el) => el.modetraction !== 'D');
    }

    resultContent = (filters.sort)
      ? resultContent.sort((a, b) => a.enginref.localeCompare(b.enginref))
      : resultContent.sort((a, b) => b.enginref.localeCompare(a.enginref));

    setTimeout(() => {
      this.setState({
        resultContent,
        isFiltering: false,
      });
    }, 0);
  }

  displayMateriel = (result) => {
    const { detailsContent } = this.state;
    const active = (detailsContent !== undefined
      && detailsContent.codenbengin === result.codenbengin);
    return (
      <TrainCompoCard
        data={result}
        displayDetails={this.displayDetails}
        active={active}
        key={result.codenbengin}
      />
    );
  }

  displayDetails = async (codenbengin) => {
    const { traincompoActions } = this.props;
    const detailsContent = await traincompoActions.getBaseGoc(codenbengin);
    this.setState({ detailsContent });
  }

  toggleFilter = (e) => {
    const { filters } = this.state;
    this.setState({
      filters: { ...filters, [e.target.name]: !filters[e.target.name] },
      isFiltering: true,
    });
  }

  render() {
    const { resultContent, detailsContent, isFiltering } = this.state;
    const { t } = this.props;

    const optionsSort = [
      { id: 'asc', name: t('common.asc') },
      { id: 'dsc', name: t('common.dsc') },
    ];

    return (
      <>
        <div className="row m-0 h-100">
          <div className="col-lg-5 h-100">
            <div className="traincompo-search p-2">
              <div className="traincompo-search-filters">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <InputSNCF
                      id="searchfilter"
                      label={t('common.filter')}
                      type="text"
                      onChange={this.searchMateriel}
                      placeholder={t('common.search')}
                      noMargin
                      sm
                    />
                  </div>
                  <div className="col-md-6 mb-3 select-osrd-sm">
                    <SelectSNCF
                      id="sortfilter"
                      name="sort"
                      title={t('common.sort')}
                      options={optionsSort}
                      selectedValue={{ id: 'asc', name: t('common.asc') }}
                      onChange={this.toggleFilter}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="col-6">
                    <CheckboxRadioSNCF onChange={this.toggleFilter} name="thor" id="thor" label="Source THOR" type="checkbox" checked />
                    <CheckboxRadioSNCF onChange={this.toggleFilter} name="cim" id="cim" label="Source CIM" type="checkbox" checked />
                  </div>
                  <div className="col-6">
                    <CheckboxRadioSNCF
                      onChange={this.toggleFilter}
                      name="elec"
                      id="elec"
                      label={(
                        <>
                          <span className="text-primary mr-1"><BsLightningFill /></span>
                          Électrique
                        </>
                      )}
                      type="checkbox"
                      checked
                    />
                    <CheckboxRadioSNCF
                      onChange={this.toggleFilter}
                      name="diesel"
                      id="diesel"
                      label={(
                        <>
                          <span className="text-pink mr-1"><MdLocalGasStation /></span>
                          Diesel
                        </>
                      )}
                      type="checkbox"
                      checked
                    />
                  </div>
                </div>
                <div className="text-center w-100 mt-3">
                  {resultContent !== undefined && resultContent.length > 0 ? `${resultContent.length} ${t('osrd.trainCompo.resultsFound')}` : t('osrd.trainCompo.noResultFound')}
                </div>
              </div>
              <div className="traincompo-search-list">
                {resultContent !== undefined && !isFiltering
                  ? resultContent.map((result) => this.displayMateriel(result))
                  : <Loader msg={t('osrd.trainCompo.waitingLoader')} /> }
              </div>
            </div>
          </div>
          <div className="col-lg-7 h-100">
            {detailsContent !== undefined ? <TrainCompoDetails data={detailsContent} /> : null}
          </div>
        </div>
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  traincompo: state.traincompo,
});

const mapDispatchToProps = (dispatch) => ({
  traincompoActions: bindActionCreators(allTrainCompoActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(TrainCompo));
