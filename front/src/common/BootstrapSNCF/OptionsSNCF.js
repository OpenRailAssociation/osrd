/* Usage
* <OptionsSNCF options={['A','B']} />
*/

import React from 'react';
import PropTypes from 'prop-types';

class OptionsSNCF extends React.Component {
  static propTypes = {
    options: PropTypes.array.isRequired,
  }

  render() {
    const { options } = this.props;

    return (
      <div className="options-control">
        {options.map((option, id) => {
          const isChecked = (id === 0) ? 'checked' : '';
          return (
            <div className="options-item" key={option}>
              <input type="radio" name="optionsRadio" id={`optionsRadio${id}`} className="sr-only" checked={isChecked} />
              <label className="options-btn font-weight-medium" htmlFor={`optionsRadio${id}`}>
                Option
                {option}
              </label>
            </div>
          );
        })}
      </div>
    );
  }
}

export default OptionsSNCF;
