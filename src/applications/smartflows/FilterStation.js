import React from 'react';
import PropTypes from 'prop-types';

export default class FilterStation extends React.Component {
  static propTypes = {
    onSubmit: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = { searchValue: '' };
  }

  clearValue = () => {
    const { onSubmit } = this.props;
    this.setState({ searchValue: '' });
    onSubmit('');
  }

  handleValue = (e) => {
    this.setState({ searchValue: e.target.value });
  }

  handleSubmit = (e) => {
    const { onSubmit } = this.props;
    const { searchValue } = this.state;
    onSubmit(searchValue);
    e.preventDefault();
  }

  render() {
    const { searchValue } = this.state;
    return (
      <form onSubmit={this.handleSubmit}>
        <div className="input-group">
          <div className="form-control-container">
            <label htmlFor="filterStation" className="sr-only">Filtrer...</label>
            <input
              id="filterStation"
              type="text"
              className="form-control form-control-sm clear-option"
              title="Filtrer..."
              placeholder="Filtrer..."
              value={searchValue}
              onChange={this.handleValue}
            />
            <button
              onClick={this.clearValue}
              type="button"
              className={`btn-clear btn-sm btn-primary ${searchValue.length > 0 ? '' : 'd-none'}`}
            >
              <span className="sr-only">Effacer texte</span>
              <i className="icons-close" aria-hidden="true" />
            </button>
          </div>
          <div className="input-group-append">
            <button type="submit" className="btn btn-sm btn-secondary btn-only-icon">
              <i className="icons-search" aria-hidden="true" />
              <span className="sr-only">Filtrer</span>
            </button>
          </div>
        </div>
      </form>
    );
  }
}
