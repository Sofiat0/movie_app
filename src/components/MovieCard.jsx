import React from 'react';

const MovieCard = ({ movie, onWatch, isDownloaded, onDownload }) => {
  const {
    title,
    vote_average,
    poster_path,
    release_date,
    original_language,
  } = movie;

  return (
    <div
      className="movie-card"
      onClick={() => onWatch?.(movie)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onWatch?.(movie);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Watch ${title}`}
    >
      <div className="movie-poster-wrap">
        <img
          src={
            poster_path
              ? `https://image.tmdb.org/t/p/w500/${poster_path}`
              : '/no-movie.png'
          }
          alt={title}
        />
        <span className="play-badge">▶ Play</span>
        <button
          type="button"
          className="mini-download-button"
          onClick={(event) => {
            event.stopPropagation();
            onDownload?.(movie);
          }}
          aria-label={isDownloaded ? `Remove ${title} from downloads` : `Download ${title}`}
        >
          {isDownloaded ? '✓' : '↓'}
        </button>
      </div>

      <div className="movie-card-body">
        <h3>{title}</h3>

        <div className="content">
          <div className="rating">
            <img src="star.svg" alt="star icon" />
            <p>{vote_average ? vote_average.toFixed(1) : 'N/A'}</p>
          </div>
          <span>•</span>
          <p className="lang">{original_language}</p>
          <span>•</span>
          <p className="year">
            {release_date ? release_date.split('-')[0] : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;