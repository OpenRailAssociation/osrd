import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

class PaginationSNCF extends Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    pages: PropTypes.number.isRequired,
    activePage: PropTypes.number.isRequired,
    firstPage: PropTypes.number.isRequired,
    getPageContent: PropTypes.func.isRequired,
    centered: PropTypes.bool,
    paginationRange: PropTypes.number,
  }

  static defaultProps = {
    centered: false,
    paginationRange: 5,
  }

  getPages = (pages) => {
    const {
      activePage, firstPage, getPageContent, paginationRange,
    } = this.props;
    const limitIndex = paginationRange < pages ? paginationRange : pages;
    const pagination = [];
    for (let index = firstPage + 1; index <= limitIndex + firstPage; index += 1) {
      pagination.push(
        <li className={index === activePage ? 'page-item active' : 'page-item'} key={index}>
          <a className="page-link" href={`#${index}`} onClick={(e) => getPageContent(e, pages)}>{index}</a>
        </li>,
      );
    }
    return pagination;
  }

  render() {
    const {
      t, pages, activePage, getPageContent, centered, paginationRange,
    } = this.props;
    const paginationPositionClasses = (!centered)
      ? 'mt-2 d-flex justify-content-end'
      : 'mt-2 d-flex justify-content-center';
    return (
      <>
        <nav role="navigation" className={paginationPositionClasses}>
          <ul className="pagination">
            <li className={pages === 1 || activePage === 1 ? 'page-item page-skip disabled' : 'page-item page-skip'}>
              <a className="page-link" href="#first" onClick={(e) => getPageContent(e, pages, paginationRange)}>
                <i className="icons-arrow-double icons-rotate-180 icons-size-x5" aria-hidden="true" />
                <span className="d-none d-sm-inline ml-2">{t('Logs.pagination.start')}</span>
              </a>
            </li>
            <li className={activePage === 1 ? 'page-item page-skip disabled' : 'page-item page-skip'}>
              <a className="page-link" href="#previous" onClick={(e) => getPageContent(e, pages, paginationRange)}>
                <i className="icons-arrow-prev icons-size-x5" aria-hidden="true" />
                <span className="d-none d-sm-inline ml-2">{t('Logs.pagination.previous')}</span>
              </a>
            </li>
            {this.getPages(pages)}
            <li className={activePage === pages ? 'page-item page-skip disabled' : 'page-item page-skip'}>
              <a className="page-link" href="#next" onClick={(e) => getPageContent(e, pages, paginationRange)}>
                <span className="d-none d-sm-inline mr-2">{t('Logs.pagination.next')}</span>
                <i className="icons-arrow-next icons-size-x5" aria-hidden="true" />
              </a>
            </li>
            <li className={pages === 1 || activePage === pages ? 'page-item page-skip disabled' : 'page-item page-skip'}>
              <a className="page-link" href="#last" onClick={(e) => getPageContent(e, pages, paginationRange)}>
                <span className="d-none d-sm-inline mr-2">{t('Logs.pagination.end')}</span>
                <i className="icons-arrow-double icons-size-x5" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </nav>
      </>
    );
  }
}

const Pagination = withTranslation()(PaginationSNCF);

export default connect()(Pagination);
