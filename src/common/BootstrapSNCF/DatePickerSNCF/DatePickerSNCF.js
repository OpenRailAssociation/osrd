import React, { Component } from 'react';
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import Flatpickr from 'react-flatpickr';
import { French } from 'flatpickr/dist/l10n/fr';

import './DatePickerSNCF.css';

export const PICKER_MODES = {
  single: 'single',
  range: 'range',
  multiple: 'multiple',
};

class RawDatePickerSNCF extends Component {
    static propTypes = {
      t: PropTypes.func.isRequired,
      mode: PropTypes.oneOf(Object.keys(PICKER_MODES)),
      date: PropTypes.string.isRequired,
      onChange: PropTypes.func.isRequired,
      onClear: PropTypes.func.isRequired,
      placeholder: PropTypes.string.isRequired,
    }

    static defaultProps = {
      mode: 'single',
    }

    openFp = () => {
      this.fp.flatpickr.toggle();
    }

    onClear = () => {
      const { onClear } = this.props;

      this.fp.flatpickr.clear();
      onClear();
    }

    renderClearButton = () => {
      const { date } = this.props;
      if (date !== undefined) {
        return (
          <button type="button" className="btn-clear btn-primary" onClick={this.onClear}>
            <span className="sr-only">Supprimer la date</span>
            <i className="icons-close" aria-hidden="true" />
          </button>
        );
      }
      return null;
    }

    render() {
      const {
        t, mode, date, onChange, placeholder,
      } = this.props;

      const flatpickrOptions = {
        locale: French,
        dateFormat: 'd/m/Y',
        mode,
      };

      return (
        <div aria-hidden="true">
          <label htmlFor="range" className="font-weight-medium mb-2">{t('Logs.filters.date')}</label>
          <div className="flatpickr-wrapper">
            <div data-component="picker" data-mode="range">
              <div className="input-group" data-toggle>
                <div className="form-control-container">
                  <Flatpickr
                    ref={(fp) => { this.fp = fp; }}
                    id={`range${nextId()}`}
                    tabIndex={-1}
                    value={date}
                    onChange={(newDate) => { onChange(newDate); }}
                    options={flatpickrOptions}
                    className="form-control no-pointer-events clear-option"
                    placeholder={placeholder}
                  />
                  <span className="form-control-state" />
                  {this.renderClearButton()}
                </div>
                <div className="input-group-append">
                  <button
                    tabIndex={-1}
                    type="button"
                    className="btn btn-primary btn-only-icon"
                    onClick={this.openFp}
                  >
                    <i className="icons-calendar" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
}

const DatePickerSNCF = withTranslation()(RawDatePickerSNCF);

export default DatePickerSNCF;
