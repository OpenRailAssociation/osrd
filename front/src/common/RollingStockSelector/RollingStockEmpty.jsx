import React from 'react';
import { FaQuestion } from 'react-icons/fa';
import icon from 'assets/pictures/components/train.svg';

export default function RollingStockEmpty() {
  return (
    <div className="rollingstock-empty">
      <span>
        <FaQuestion />
      </span>
      <img src={icon} alt="empty rolling stock list" />
    </div>
  );
}
