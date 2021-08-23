import React from 'react';
import PropTypes from 'prop-types';
import { FlyToInterpolator } from 'react-map-gl';
import bbox from '@turf/bbox';
import { getCursor } from 'utils/helpers';
import { connect } from 'react-redux';
import * as allMainActions from 'reducers/main';
import { bindActionCreators } from 'redux';
import Hover from 'common/Map/Hover';
import Selected from 'common/Map/Selected';
import ActionBarSNCF from 'common/BootstrapSNCF/ActionBarSNCF/ActionBar';
import ActionBarItem, { BAR_ITEM_TYPES } from 'common/BootstrapSNCF/ActionBarSNCF/ActionBarItem';
import TableSNCF from 'common/BootstrapSNCF/TableSNCF/TableSNCF';
import ButtonFullscreen from 'common/ButtonFullscreen';
import FiltersMenu from 'applications/smartflows/FiltersMenu';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import dgexSolLogoOnly from 'assets/pictures/dgexsollogo_only.png';
import sncfReseauLogo from '@sncf/bootstrap-sncf.metier.reseau/dist/assets/img/brand/sncf-reseau-logo.png';
import garesetcologo from 'assets/pictures/garesetcologo.png';

import Map from './Map';
import 'applications/smartflows/smartflows.css';
import LineGraph from './LineGraph';
import FilterStation from './FilterStation';


class HomeSmartFlows extends React.Component {
  static propTypes = {
    main: PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {
      stationDetails: {},
      infos: {},
      geoJson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4, 37.8] } },
        ],
      },
      listeGares: [],
      listeGaresSortBy: 'pctm2',
    };
  }

  componentDidMount = () => {
    /* Download geojson data & sync */
    const fetchData = async () => {
      const res = await fetch('https://static.osm.osrd.fr/smartflows/realtime.geojson');
      const geoJson = await res.json();
      const res2 = await fetch('https://static.osm.osrd.fr/smartflows/getInfos.php');
      const infos = await res2.json();
      this.updateGeoJson(geoJson);
      this.setState({
        infos,
        geoJson,
      });
    };
    fetchData();

    this.interval = setInterval(fetchData, 300000);
  }

  componentWillUnmount = () => {
    clearInterval(this.interval);
  }

  onFeatureClick = (e) => {
    const { listeGares } = this.state;
    if (e.features[0] !== undefined && e.features[0].properties.uic > 0) {
      const stationDetails = listeGares.find((el) => el.id === e.features[0].properties.uic);
      this.setState({ stationDetails });
      this.flyToStation();
    }
  }

  updateGeoJson = (geoJson) => {
    this.setState({ geoJson });
    this.listeGares();
  }

  onFeatureHover = (e) => {
  }

  genLibelle = (libelle, pct) => {
    let color;
    if (pct < 60) {
      color = 'icons-slider-on text-green mr-1';
    } else if (pct < 70) {
      color = 'icons-slider-on text-teal mr-1';
    } else if (pct < 80) {
      color = 'icons-slider-on text-yellow mr-1';
    } else if (pct < 90) {
      color = 'icons-slider-on text-orange mr-1';
    } else {
      color = 'icons-slider-on text-red mr-1';
    }
    return (
      <span>
        <i className={color} />
        {libelle}
      </span>
    );
  }

  onClickStationDetails = (e) => {
    const { listeGares } = this.state;
    const uic = e.currentTarget.id;
    const stationDetails = listeGares.find((el) => el.id === uic);
    this.setState({ stationDetails });
  }

  onCloseStationDetails = () => {
    this.setState({ stationDetails: {} });
  }

  flyToStation = () => {
    const { stationDetails } = this.state;
    if (stationDetails.id !== undefined) {
      this.setState({
        flyTo:
        {
          lon: stationDetails.geoloc[0],
          lat: stationDetails.geoloc[1],
          zoom: 12,
          duration: 1000,
          transitionInterpolator: new FlyToInterpolator(),
        },
      });
    }
  }

  listeGaresSort = (sortBy) => {
    const listeTypesSort = ['station', 'pct', 'pctm2', 'nb'];
    this.setState({
      listeGaresSortBy: listeTypesSort[sortBy],
    }, () => {
      this.listeGares();
    });
  }

  listeGares = (searchStation) => {
    const { geoJson, stationDetails, listeGaresSortBy } = this.state;
    const searchStationRegExp = (searchStation !== undefined) ? new RegExp(searchStation, 'i') : '';
    if (geoJson !== undefined) {
      const { features } = geoJson;
      const list = [];

      switch (listeGaresSortBy) {
        case 'station':
          features.sort((a, b) => a.properties.libelle.localeCompare(b.properties.libelle));
          break;
        case 'pct':
          features.sort((a, b) => a.properties.frequentationPCT - b.properties.frequentationPCT).reverse();
          break;
        case 'nb':
          features.sort((a, b) => a.properties.frequentationRT - b.properties.frequentationRT).reverse();
          break;
        default:
          features.sort((a, b) => a.properties.frequentationPCTm2 - b.properties.frequentationPCTm2).reverse();
      }

      for (let i = 0; i < features.length; i += 1) {
        if (features[i].properties.active === 1 && (searchStation === undefined || features[i].properties.libelle.search(searchStationRegExp) !== -1)) {
          list.push ({
            id: features[i].properties.uic,
            name: features[i].properties.libelle,
            surface: features[i].properties.surface,
            people: features[i].properties.frequentationRT,
            density: features[i].properties.frequentationPCTm2,
            geoloc: features[i].geometry.coordinates,
            items: [
              this.genLibelle(features[i].properties.libelle, Number(features[i].properties.frequentationPCTm2)),
              features[i].properties.frequentationPCT,
              features[i].properties.frequentationPCTm2 / 100,
              features[i].properties.frequentationRT,
            ],
          });
        }
      }
      this.setState({ listeGares: list });
      if (stationDetails.id === undefined) {
        this.setState({ stationDetails: list[0] });
      }
    }
  }

  render() {
    const { main } = this.props;
    const {
      geoJson,
      stationDetails,
      infos,
      listeGares,
      flyTo,
    } = this.state;

    return (
      <>
        <NavBarSNCF appName="Affluence voyageurs temps-réel" logo={sncfReseauLogo} />
        <ActionBarSNCF
          titlelogo={dgexSolLogoOnly}
          classes="smartflows"
        >
          <li className="toolbar-item toolbar-item-spacing">
            <img src={garesetcologo} style={{ height: '2em' }} alt="gares et connexion logo" />
          </li>
          <li className="toolbar-item toolbar-item-spacing">
            <small>{`${infos.nbgares - infos.nbgaresinactives}/${infos.nbgares} GARES ACTIVES`}</small>
          </li>
          <li className="toolbar-item toolbar-item-spacing">
            <small>
              {infos.lasttime}
            </small>
          </li>
          <li className="toolbar-item toolbar-item-spacing">
            <div className="d-flex align-items-center">
              <strong className="mr-3">p/m²</strong>
              <small className="mr-2 d-flex align-items-center">
                <i className="text-default icons-slider-on mr-1" />
                absence données
              </small>
              <small className="mr-2 d-flex align-items-center">
                <i className="text-green icons-slider-on mr-1" />
                &#60; 0,60
              </small>
              <small className="mr-2 d-flex align-items-center">
                <i className="text-teal icons-slider-on mr-1" />
                &#60; 0,70
              </small>
              <small className="mr-2 d-flex align-items-center">
                <i className="text-yellow icons-slider-on mr-1" />
                &#60; 0,80
              </small>
              <small className="mr-2 d-flex align-items-center">
                <i className="text-orange icons-slider-on mr-1" />
                &#60; 0,90
              </small>
              <small className="mr-2 d-flex align-items-center">
                <i className="text-red icons-slider-on mr-1" />
                &#60; 1
              </small>
              <small className="d-flex align-items-center">
                <i className="text-pink icons-slider-on mr-1" />
                &#62;= 1
              </small>
            </div>
          </li>
          {/* <ActionBarItem
            type={BAR_ITEM_TYPES.iconButton}
            content="Filters"
            onClick={this.toggleFiltersMenu}
            iconName="icons-filters"
          /> */}
        </ActionBarSNCF>

        <main className={`mastcontainer smartflows${main.fullscreen ? ' fullscreen' : ''}`}>
          {/* <FiltersMenu /> */}
          <div className="row no-gutters half-screen">
            <div className="col-md-6 col-xl-5">
              <div className="top-gares">
                <div className="top-gares-title d-flex justify-content-between align-items-center">
                  Liste des gares
                  <FilterStation onSubmit={this.listeGares} />
                </div>
                <TableSNCF
                  headerContent={['Gare', '% Ref', 'p/m²', 'Nb']}
                  headerSort={this.listeGaresSort}
                  content={listeGares}
                  hovered
                  onClick={this.onClickStationDetails}
                  selected={stationDetails.id}
                />
              </div>
            </div>
            <div className="col-md-6 col-xl-7">
              <div className="map-container">
                <Map geoJson={geoJson} onFeatureClick={this.onFeatureClick} flyTo={flyTo} />
              </div>
            </div>
          </div>
          <div className="row no-gutters half-screen">
            <div className="col-12">
              <LineGraph
                stationDetails={stationDetails}
                onCloseStationDetails={this.onCloseStationDetails}
                flyToStation={this.flyToStation}
              />
            </div>
          </div>
          <ButtonFullscreen />
        </main>
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

const mapDispatchToProps = (dispatch) => ({
  mainActions: bindActionCreators(allMainActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(HomeSmartFlows);
