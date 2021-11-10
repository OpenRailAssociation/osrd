import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Layer } from 'react-map-gl';
import { hoverLayer, hoverCircleLayer } from 'common/Map/Layers/commonlayers';

class Hover extends Component {
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

    if (map.featureInfoHoverID) {
      const id = map.featureInfoHoverID;
      const hoverLayerRender = type === 'line'
        ? {
          ...hoverLayer,
          id: `${sourceLayer}HoverLayer`,
          filter: ['==', filterField, id],
        }
        : {
          ...hoverCircleLayer,
          id: `${sourceLayer}HoverLayer`,
          filter: ['==', filterField, id],
        };

      return (
        <Layer
          {...hoverLayerRender}
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

export default connect(mapStateToProps, mapDispatchToProps)(Hover);
