
import React from "react";

const Search = ({ searchTerm, setSearchTerm, onSearch }) => {
  return (
    <div className="search-shell">
      <div className="search">
        <div className="search-input-wrap">
          <img src="/search.svg" alt="Search" />

          <input
            type="text"
            placeholder="Search for a movie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSearch();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Search;

