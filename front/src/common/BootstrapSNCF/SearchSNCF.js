import React from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

import Loader from 'common/Loader';
import InputSNCF from './InputSNCF';

class SearchSNCF extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    advancedSearch: PropTypes.bool,
    searchResults: PropTypes.array,
    onResultClick: PropTypes.func,
    isSearchLoading: PropTypes.bool,
    value: PropTypes.string,
    noMargin: PropTypes.bool,
    hideResultsWhenNoValue: PropTypes.bool,
  };

  static defaultProps = {
    advancedSearch: false,
    searchResults: undefined,
    onResultClick: () => {},
    isSearchLoading: false,
    value: undefined,
    noMargin: false,
    hideResultsWhenNoValue: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      active: false,
    };
    this.searchContainerRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  sliceArray = (array) => array.slice(0, 15);

  handleClickOutside = (event) => {
    if (
      this.searchContainerRef.current &&
      !this.searchContainerRef.current.contains(event.target)
    ) {
      this.setState({ active: false });
    }
  };

  render() {
    const {
      searchResults,
      onResultClick,
      advancedSearch,
      value,
      isSearchLoading,
      noMargin,
      hideResultsWhenNoValue,
      t,
      ...props
    } = this.props;
    const { active } = this.state;
    const displayResults = hideResultsWhenNoValue ? Boolean(value) : active;
    const inputActive = displayResults ? 'active' : '';

    let resultsContent;
    if (isSearchLoading) {
      resultsContent = <Loader position="center" />;
    } else if (searchResults.length !== 0) {
      resultsContent = (
        <ul className="list-unstyled mb-0">
          {searchResults.map((result) => (
            <React.Fragment key={`search-result-${nextId()}`}>
              <li className="advanced-search-menu-item advanced-search-menu-title">
                <span>{result.title}</span>
              </li>
              {this.sliceArray(result.content).map((element) => (
                <li className="advanced-search-menu-item mt-0" key={`element-${nextId()}`}>
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => {
                      onResultClick(element);
                      this.setState({ active: false });
                    }}
                  >
                    {element.title}
                  </button>
                </li>
              ))}
            </React.Fragment>
          ))}
        </ul>
      );
    } else {
      resultsContent = <>{t('Aucun résultat à afficher.')}</>;
    }

    // Build conditional classes
    const containerMargin = noMargin ? '' : 'mb-4';

    return (
      <div
        className={`advanced-search w-100 ${containerMargin} ${inputActive}`}
        ref={this.searchContainerRef}
      >
        <div className="advanced-search-control">
          <InputSNCF
            noMargin={noMargin}
            value={value}
            inputProps={{
              onFocus: () => this.setState({ active: true }),
            }}
            {...props}
          />
          {displayResults && (
            <div role="list" className="advanced-search-menu" data-role="menu">
              {resultsContent}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default withTranslation()(SearchSNCF);
