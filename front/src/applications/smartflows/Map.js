import React from 'react';
import PropTypes from 'prop-types';

import ReactMapGL from 'react-map-gl';
import bbox from '@turf/bbox';
import { getCursor } from 'utils/helpers';
import Hover from 'common/Map/Hover';
import Selected from 'common/Map/Selected';
import mapStyle from 'assets/mapstyles/style_osrd_light_railways.json';

import SmartFlow from 'common/Map/Layers/SmartFlow';

export default class Map extends React.Component {
  static propTypes = {
    geoJson: PropTypes.object.isRequired,
    flyTo: PropTypes.object,
    onFeatureClick: PropTypes.func.isRequired,
  }

  static defaultProps = {
    flyTo: undefined,
  }

  constructor(props) {
    super(props);
    this.state = {
      viewport: {
        latitude: 48.8588,
        longitude: 2.3328,
        zoom: 11.4016,
        bearing: 0,
        pitch: 0,
        // transformRequest: (url, resourceType) => transformRequest(url, resourceType, MAP_URL),
      },
    };
  }

  onFeatureHover = (e) => {
  }

  flyTo = (longitude, latitude, zoom, transitionDuration, transitionInterpolator) => {
    const { viewport } = this.state;
    const newViewport = {
      ...viewport,
      longitude,
      latitude,
      zoom,
      transitionDuration,
      transitionInterpolator,
    };
    this.setState({ viewport: newViewport });
  }

  onViewportChange = (viewport) => {
    this.setState({ viewport });
  }

  componentDidUpdate = (prevProps) => {
    const { flyTo } = this.props;
    if (flyTo !== undefined && (prevProps.flyTo === undefined || prevProps.flyTo.lat != flyTo.lat || prevProps.flyTo.lon != flyTo.lon)) {
      this.flyTo(flyTo.lon, flyTo.lat, flyTo.zoom, flyTo.transitionDuration, flyTo.transitionInterpolator);
    }
  }

  render() {
    const { geoJson, onFeatureClick } = this.props;
    const { viewport } = this.state;

    return (
      <>
        <ReactMapGL
          {...viewport}
          style={{ cursor: 'pointer' }}
          width="100%"
          height="100%"
          mapStyle={mapStyle}
          onViewportChange={this.onViewportChange}
          // onHover={this.onFeatureHover}
          onClick={onFeatureClick}
          getCursor={getCursor} // Change cursor following hoveringable (!) layer
          interactiveLayerIds={['circleLayer']} // Needed to allow getCursor & interactivity ,
          preventStyleDiffing
        >
          <SmartFlow geoJson={geoJson} />
        </ReactMapGL>
      </>
    );
  }
}
