import React from 'react';

type SearchResultItemProps = {
  resultSearchItem: { [key: string]: string };
  onResultClick: (result: { [key: string]: string }) => void;
};

const SearchResultItem: React.FC<SearchResultItemProps> = ({ resultSearchItem, onResultClick }) => (
  <button
    className="search-result-item d-flex justify-content-between mb-1 align-items-center"
    onClick={() => onResultClick(resultSearchItem)}
    type="button"
  >
    <div className="name">{resultSearchItem.name || resultSearchItem.line_name}</div>
    <div className="text-right">
      <div className="trigram">
        {resultSearchItem.trigram || resultSearchItem.line_code}&nbsp;
        {resultSearchItem.ch && <span className="ch small">{resultSearchItem.ch}</span>}
      </div>
    </div>
  </button>
);

export default SearchResultItem;
