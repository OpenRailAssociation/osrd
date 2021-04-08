import React from 'react';
import PropTypes from 'prop-types';
import {
  Source, Layer,
} from 'react-map-gl';
import Hover from 'common/Map/Hover';
import Selected from 'common/Map/Selected';
import { MAP_MODES } from 'common/Map/const';
import { connect } from 'react-redux';
import { MIDI_OBJECTS_KEYS, getMidiObjectByKey } from 'common/Map/Consts/MidiObjects';

const HIDE_SIBLINGS_KEYS = [
  MIDI_OBJECTS_KEYS.zep,
  MIDI_OBJECTS_KEYS.sel,
  MIDI_OBJECTS_KEYS.itineraire,
];

class LinearObject extends React.Component {
  static propTypes = {
    map: PropTypes.object.isRequired,
    mapURL: PropTypes.string.isRequired,
    sourceLayer: PropTypes.string.isRequired,
    sourceTable: PropTypes.string.isRequired,
    mapMode: PropTypes.string,
    source: PropTypes.string,
    color: PropTypes.string,
    width: PropTypes.number,
  }

  static defaultProps = {
    color: '#cd0037',
    width: 2,
    source: 'midi',
    mapMode: MAP_MODES.display,
  }

  line = () => {
    const {
      sourceTable, color, width, mapMode, map,
    } = this.props;

    const sourcesToHide = HIDE_SIBLINGS_KEYS.map((key) => getMidiObjectByKey(key).sourceTable);
    let isSourceTableRequired = false;
    if (map.selectedProperty) {
      const selectedPropertySource = getMidiObjectByKey(map.selectedProperty.requiredLayer).sourceTable;
      isSourceTableRequired = selectedPropertySource === sourceTable;
    }

    const hideSiblings = map.selectedObjectLayer !== undefined
                      && map.selectedObjectLayer.sourceTable === sourceTable
                      && map.featureInfoClickID !== undefined
                      && sourcesToHide.includes(sourceTable)
                      && !isSourceTableRequired;

    let paint = {
      'line-color': color,
      'line-width': width,
    };
    if (mapMode === MAP_MODES.modification) {
      paint = {
        'line-color': [
          'case',
          ['==', ['get', 'isVerifie'], ['boolean', true]], '#82be00',
          color,
        ],
        'line-width': [
          'case',
          ['==', ['get', 'isVerifie'], ['boolean', true]], 3,
          width,
        ],
      };
    }

    const layerProps = {
      id: `${sourceTable}Layer`,
      type: 'line',
      'source-layer': sourceTable,
      paint,
    };

    if (hideSiblings) {
      layerProps.filter = ['==', 'OP_id', map.popupContent.OP_id];
    }

    return layerProps;
  }

  render() {
    const {
      mapURL, sourceLayer, sourceTable, source,
    } = this.props;

    return (
      <Source id={`${sourceTable}-${sourceLayer}-source`} type="vector" url={`${mapURL}/map/layer_def/${source}/${sourceTable}/${sourceLayer}/`}>
        <Layer {...this.line()} />
        <Selected sourceLayer={sourceTable} filterField="OP_id" />
        <Hover sourceLayer={sourceTable} filterField="OP_id" />
      </Source>
    );
  }
}

const mapStateToProps = (state) => ({
  map: state.map,
});

const mapDispatchToProps = () => ({
});

export default connect(mapStateToProps, mapDispatchToProps)(LinearObject);
