import React, { type FC } from 'react';

import cx from 'classnames';
import { Link } from 'react-router-dom';

import './CardSNCF.scss';

interface CardProps {
  link: string;
  img: string;
  title: string;
  disabledLink: boolean;
}
const Card: FC<CardProps> = ({ link, img, title, disabledLink = false }) => (
  <Link to={link} className={cx('card overflow-hidden mb-2', disabledLink && 'disabled-link')}>
    <img className="card-img-top" alt={title} src={img} />
    <div className="card-body text-center">
      <h5 className="card-title mb-0 text-base font-weight-normal">{title}</h5>
    </div>
  </Link>
);

export default Card;
