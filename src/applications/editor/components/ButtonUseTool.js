import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { selectTool } from 'reducers/editor';
import { bindActionCreators } from 'redux';

class ButtonUseTool extends React.Component {
  static propTypes = {
    tool: PropTypes.string.isRequired,
    icon: PropTypes.any.isRequired,
    label: PropTypes.string.isRequired,
    activeTool: PropTypes.string,
    disabled: PropTypes.bool,

    // Logic:
    actions: PropTypes.object.isRequired,
  };

  static defaultProps = {
    activeTool: null,
    disabled: false,
  };

  render() {
    const { tool, icon, label, actions, activeTool, disabled } = this.props;
    const IconComponent = icon;

    return (
      <button
        type="button"
        className={`btn-rounded ${activeTool === tool ? 'btn-rounded-white' : ''}`}
        onClick={() => actions.updateActiveTool(tool)}
        disabled={disabled}
        title={label}
      >
        <span className="sr-only">{label}</span>
        <IconComponent />
      </button>
    );
  }
}

const mapStateToProps = (state) => ({
  activeTool: state.editor.activeTool,
});

const mapDispatchToProps = (dispatch) => ({
  actions: bindActionCreators({ updateActiveTool: selectTool }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ButtonUseTool);
