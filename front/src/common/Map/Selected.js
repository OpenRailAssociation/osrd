import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Layer } from 'react-map-gl';
import { selectedLayer, selectedCircleLayer } from 'common/Map/Layers/commonlayers';

class Selected extends Component {
  static propTypes = {
    map: PropTypes.object.isRequired,
    source: PropTypes.string.isRequired,
    sourceLayer: PropTypes.string.isRequired,
    filterField: PropTypes.string,
    type: PropTypes.oneOf([
      'line',
      'circle',
    ]),
  }

  static defaultProps = {
    filterField: 'id',
    type: 'line',
  }

  render() {
    const {
      map, source, sourceLayer, filterField, type,
    } = this.props;

    if (map.featureInfoClickID) {
      const id = map.featureInfoClickID;
      const selectedLayerRender = type === 'line'
        ? {
          ...selectedLayer,
          id: `${sourceLayer}SelectedLayer`,
          filter: ['==', filterField, id],
        }
        : {
          ...selectedCircleLayer,
          id: `${sourceLayer}SelectedLayer`,
          filter: ['==', filterField, id],
        };

      return (
        <Layer
          {...selectedLayerRender}
          source={source}
          source-layer={sourceLayer}
        />
      );
    }
    return null;
  }
}

const mapStateToProps = (state) => ({
  map: state.map,
});

const mapDispatchToProps = {

};

export default connect(mapStateToProps, mapDispatchToProps)(Selected);
