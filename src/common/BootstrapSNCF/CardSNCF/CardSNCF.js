import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';

class Card extends React.Component {
  static propTypes = {
    link: PropTypes.string.isRequired,
    img: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    disabledLink: PropTypes.bool,
    user: PropTypes.object.isRequired,
  }

  static defaultProps = {
    disabledLink: false,
  }

  render() {
    const {
      img, link, title, disabledLink,
    } = this.props;
    return (
    // disabledLink
    // ? (
      <Link to={link} className={`card overflow-hidden mb-2 ${disabledLink ? 'disabled-link' : ''}`}>
        <img className="card-img-top" alt={title} src={img} />
        <div className="card-body text-center">
          <h5 className="card-title mb-0 text-base font-weight-normal">{title}</h5>
        </div>
      </Link>
    // ) : <Link to="/" />
    );
  }
}

const mapStateToProps = (state) => ({
  user: state.user,
});
export default connect(mapStateToProps)(Card);
