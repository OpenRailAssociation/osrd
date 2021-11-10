import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { bindActionCreators } from 'redux';

// Components
import FilterMenuItemSNCF from 'common/BootstrapSNCF/FilterMenuSNCF/FilterMenuItemSNCF';
import FilterMenuCategorySNCF from 'common/BootstrapSNCF/FilterMenuSNCF/FilterMenuCategorySNCF';
import FilterMenuSNCF from 'common/BootstrapSNCF/FilterMenuSNCF/FilterMenuSNCF';

// Assets and Styles
import osmPicture from 'assets/pictures/osm.png';
import osmLightPicture from 'assets/pictures/osmLight.png';
import mapStyleJSON from 'assets/mapstyles/style_osrd_light.json';
import mapStyleEmptyJSON from 'assets/mapstyles/style_osrd_empty.json';
import * as allMapActions from 'reducers/map';

class RawFiltersMenu extends Component {
  static propTypes = {
    map: PropTypes.object.isRequired,
    mapActions: PropTypes.object.isRequired,
    t: PropTypes.func.isRequired,
  }

  toggleOSM = (e) => {
    const { mapActions } = this.props;
    const mapStyle = e.target.value === 'osm' ? mapStyleJSON : mapStyleEmptyJSON;
    mapActions.updateMapStyle(mapStyle, 'osm');
  }

  toggleFiltersMenu = () => {
    const { mapActions } = this.props;
    mapActions.toggleFilters();
  }

  layerVisibility = (e) => {
    const { mapActions } = this.props;
    mapActions.updateLayerProperty(e.target.value, 'visible', e.target.checked);
  }

  render = () => {
    const { t, map } = this.props;

    return (
      <FilterMenuSNCF title={t('Map.filtersMenu.title')} isShown={map.filters.shown} toggleFiltersMenu={this.toggleFiltersMenu}>
        <FilterMenuCategorySNCF title={t('Map.filtersMenu.tiles.title')} htmlID={`filterCategory${nextId()}`}>
          <FilterMenuItemSNCF
            title={t('Map.filtersMenu.tiles.osmLight')}
            picture={osmLightPicture}
            htmlID={`filterItem${nextId()}`}
            onChange={this.toggleOSM}
            radio
            name="filterTiles"
            value="osmlight"
            checked={!map.filters.osm}
          />
          <FilterMenuItemSNCF
            title={t('Map.filtersMenu.tiles.osm')}
            picture={osmPicture}
            htmlID={`filterItem${nextId()}`}
            onChange={this.toggleOSM}
            checked={map.filters.osm}
            radio
            name="filterTiles"
            value="osm"
          />
        </FilterMenuCategorySNCF>
      </FilterMenuSNCF>
    );
  }
}

const FiltersMenu = withTranslation()(RawFiltersMenu);

const mapStateToProps = (state) => ({
  map: state.map,
});

const mapDispatchToProps = (dispatch) => ({
  mapActions: bindActionCreators(allMapActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(FiltersMenu);
