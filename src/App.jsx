import  { useEffect, useState } from 'react'
import './app.css'
import Search from './components/Search'
import Spinner from './components/spinner'
import MovieCard from './components/MovieCard';
import { getTrendingMovies, updateSearchCount } from './appwrite.js';


const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const SITE_VIDEO_URL = import.meta.env.VITE_MOVIE_STREAM_URL || '';
const BACKEND_STREAM_URL = import.meta.env.VITE_STREAM_API_URL || 'http://localhost:3001/api/stream-url';
const API_OPTION = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`
  }
}

const FIXED_TRAILER_KEYS = {
  'Spider-Man: Brand New Day': '62bIsvRcPv0',
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [movieList, setMovieList] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [trailerKey, setTrailerKey] = useState('');
  const [movieVideoSource, setMovieVideoSource] = useState('');
  const [playerFailed, setPlayerFailed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isloading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [downloadedMovies, setDownloadedMovies] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('Home');
  const [activeTab, setActiveTab] = useState('Home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profilePageOpen, setProfilePageOpen] = useState(false);
  const [isEditingProfileName, setIsEditingProfileName] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('soffy_movie_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  const navTabs = ['Home', 'TV Shows', 'Movies', 'My List'];
  const genreOptions = ['Home', 'TV Shows', 'Movies', 'Action', 'Drama', 'Comedy', 'Sci‑Fi'];

  const activeMovieList = isSearchActive ? searchResults : movieList;

  const filteredMovieList = (() => {
    if (activeTab === 'TV Shows') {
      return activeMovieList.filter((movie) => (movie.genre_ids || []).some((genre) => [18, 35, 80, 10749].includes(genre)) || movie.vote_average >= 7).slice(0, 18);
    }

    if (activeTab === 'Movies') {
      return activeMovieList.filter((movie) => (movie.genre_ids || []).length > 0).slice(0, 18);
    }

    if (activeTab === 'My List') {
      return downloadedMovies.length ? downloadedMovies : activeMovieList.slice(0, 8);
    }

    return activeMovieList;
  })();

  const topTenMovies = [...filteredMovieList]
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 10);

  const featuredMovie = filteredMovieList[0] || movieList[0] || null;

  const genreBuckets = {
    Action: filteredMovieList.filter((movie) => (movie.genre_ids || []).includes(28)).slice(0, 8),
    Drama: filteredMovieList.filter((movie) => (movie.genre_ids || []).includes(18)).slice(0, 8),
    Comedy: filteredMovieList.filter((movie) => (movie.genre_ids || []).includes(35)).slice(0, 8),
    SciFi: filteredMovieList.filter((movie) => (movie.genre_ids || []).includes(878)).slice(0, 8),
  };

  const rowSections = [
    { title: 'Trending Now', items: filteredMovieList.slice(0, 8) },
    { title: 'Continue Watching', items: filteredMovieList.slice(4, 12) },
    { title: 'My List', items: downloadedMovies.length ? downloadedMovies : filteredMovieList.slice(8, 16) },
    { title: 'Action', items: genreBuckets.Action },
    { title: 'Drama', items: genreBuckets.Drama },
    { title: 'Comedy', items: genreBuckets.Comedy },
    { title: 'Sci‑Fi', items: genreBuckets.SciFi },
  ].filter((section) => section.items.length > 0);

  const visibleSections = (() => {
    if (activeTab === 'My List') {
      return [
        {
          title: 'My List',
          items: downloadedMovies.length ? downloadedMovies : filteredMovieList.slice(0, 8),
        },
      ];
    }

    if (activeTab === 'Home' || activeTab === 'Movies' || selectedGenre === 'Home' || selectedGenre === 'Movies') {
      return rowSections;
    }

    if (activeTab === 'TV Shows' || selectedGenre === 'TV Shows') {
      return rowSections.filter((section) =>
        ['Trending Now', 'Continue Watching', 'Action', 'Drama', 'Comedy', 'Sci‑Fi'].includes(section.title)
      );
    }

    if (selectedGenre === 'Action' || selectedGenre === 'Drama' || selectedGenre === 'Comedy' || selectedGenre === 'Sci‑Fi') {
      return rowSections.filter((section) => section.title === selectedGenre);
    }

    return rowSections;
  })();

  const normalizeText = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

  const fetchMovies = async (query = '') => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const endpoint = query
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;

      const response = await fetch(endpoint, API_OPTION);

      if (!response.ok) {
        throw new Error('Failed to fetch movies');
      }

      const data = await response.json();

      if (data.Response === 'False') {
        setErrorMessage(data.Error || 'failed to fetch movies');
        setMovieList([]);
        setSearchResults([]);
        return;
      }

      const list = data.results || [];

      if (query) {
        const exactMatches = list.filter((movie) => {
          const title = normalizeText(movie.title || movie.original_title || '');
          const queryTitle = normalizeText(query);

          return title === queryTitle || title.includes(queryTitle);
        });

        const finalResults = exactMatches.length ? exactMatches : list;
        setSearchResults(finalResults);
        setIsSearchActive(true);

        if (finalResults.length > 0) {
          await updateSearchCount(query, finalResults[0]);
        }
      } else {
        setMovieList(list);
        setSearchResults([]);
        setIsSearchActive(false);
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
      setErrorMessage('Error fetching movies. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrendingMovies = async () => {
    try {
      const movies = await getTrendingMovies();
      setTrendingMovies(movies);
    } catch (error) {
      console.error(`Error fetching trending movies: ${error}`);
    }
  };

  useEffect(() => {
    fetchMovies('');
  }, []);

  useEffect(() => {
    loadTrendingMovies();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setProfileNameDraft(currentUser.name || '');
    } else {
      setProfileNameDraft('');
    }
  }, [currentUser, profilePageOpen]);

  const handleSearchSubmit = async () => {
    const trimmedQuery = searchTerm.trim();

    if (!trimmedQuery) {
      setIsSearchActive(false);
      setSearchResults([]);
      setErrorMessage('');
      await fetchMovies('');
      return;
    }

    await fetchMovies(trimmedQuery);
  };

  const ensureSignedIn = (action) => {
    if (!currentUser) {
      setAuthError('Create an account or log in before you can watch or download movies.');
      setAuthMode('login');
      setAuthModalOpen(true);
      return false;
    }

    action();
    return true;
  };

  const toggleDownload = (movie) => {
    if (!currentUser) {
      setAuthError('Create an account or log in before you can download movies.');
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    setDownloadedMovies((prev) => {
      const exists = prev.some((item) => item.id === movie.id);

      if (exists) {
        return prev.filter((item) => item.id !== movie.id);
      }

      return [movie, ...prev].slice(0, 12);
    });
  };

  const isMovieDownloaded = (movieId) => downloadedMovies.some((movie) => movie.id === movieId);

  const fetchMovieTrailerKey = async (movie) => {
    if (!movie?.id) return '';

    const movieTitle = movie.title || movie.original_title || '';
    const normalizedMovieTitle = normalizeText(movieTitle);
    const preferredFixedKey = Object.entries(FIXED_TRAILER_KEYS).find(([title]) => {
      const normalizedTitle = normalizeText(title);
      return normalizedMovieTitle.includes(normalizedTitle) || normalizedTitle.includes(normalizedMovieTitle);
    })?.[1];

    if (preferredFixedKey) {
      return preferredFixedKey;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/movie/${movie.id}/videos?language=en-US`, API_OPTION);

      if (!response.ok) {
        return '';
      }

      const data = await response.json();
      const results = data.results || [];
      const teaser =
        results.find((video) => video.site === 'YouTube' && video.type === 'Teaser' && video.official) ||
        results.find((video) => video.site === 'YouTube' && video.type === 'Teaser');
      const trailer =
        results.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official) ||
        results.find((video) => video.site === 'YouTube' && video.type === 'Trailer') ||
        results.find((video) => video.site === 'YouTube');

      return (teaser || trailer)?.key || '';
    } catch (error) {
      console.error('Error fetching trailer:', error);
      return '';
    }
  };

  const watchMovie = async (movie) => {
    if (!movie?.id) return;

    if (!currentUser) {
      setAuthError('Create an account or log in before you can watch movies.');
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    try {
      const streamResponse = await fetch(BACKEND_STREAM_URL);
      const streamData = await streamResponse.json();
      const fullMovieSource =
        movie.video_url ||
        movie.fullVideoUrl ||
        movie.full_movie_url ||
        movie.movie_url ||
        streamData?.url ||
        import.meta.env.VITE_MOVIE_STREAM_URL ||
        SITE_VIDEO_URL;
      const trailer = await fetchMovieTrailerKey(movie);

      setSelectedMovie(movie);
      setTrailerKey(trailer);
      setMovieVideoSource(fullMovieSource || '');
      setPlayerFailed(false);
    } catch {
      const fullMovieSource =
        movie.video_url ||
        movie.fullVideoUrl ||
        movie.full_movie_url ||
        movie.movie_url ||
        import.meta.env.VITE_MOVIE_STREAM_URL ||
        SITE_VIDEO_URL;
      const trailer = await fetchMovieTrailerKey(movie);

      setSelectedMovie(movie);
      setTrailerKey(trailer);
      setMovieVideoSource(fullMovieSource || '');
      setPlayerFailed(false);
    }
  };

  const closeMoviePlayer = () => {
    setSelectedMovie(null);
    setTrailerKey('');
    setMovieVideoSource('');
    setPlayerFailed(false);
    setIsFullScreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullScreen((prev) => !prev);
  };

  const openAuthModal = () => {
    setAuthError('');
    setAuthMode('login');
    setAuthForm({ name: '', email: '', password: '' });
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthError('');
    setAuthForm({ name: '', email: '', password: '' });
  };

  const handleAuthInput = (event) => {
    const { name, value } = event.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = (event) => {
    event.preventDefault();

    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password.trim();
    const name = authForm.name.trim();

    const users = JSON.parse(localStorage.getItem('soffy_movie_users') || '[]');

    if (authMode === 'signup') {
      if (!name || !email || !password) {
        setAuthError('Please fill in your name, email, and password.');
        return;
      }

      if (password.length < 6) {
        setAuthError('Password must be at least 6 characters long.');
        return;
      }

      const userExists = users.some((user) => user.email.toLowerCase() === email);
      if (userExists) {
        setAuthError('An account with this email already exists. Please log in instead.');
        return;
      }

      const newUser = { id: crypto.randomUUID(), name, email, password };
      users.push(newUser);
      localStorage.setItem('soffy_movie_users', JSON.stringify(users));
      setCurrentUser(newUser);
      localStorage.setItem('soffy_movie_session', JSON.stringify(newUser));
      closeAuthModal();
      return;
    }

    if (!email || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    const matchedUser = users.find(
      (user) => user.email.toLowerCase() === email && user.password === password
    );

    if (!matchedUser) {
      setAuthError('Incorrect email or password. Please try again.');
      return;
    }

    setCurrentUser(matchedUser);
    localStorage.setItem('soffy_movie_session', JSON.stringify(matchedUser));
    closeAuthModal();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('soffy_movie_session');
    setProfileMenuOpen(false);
    setProfilePageOpen(false);
    closeAuthModal();
  };

  const handleProfileNameSave = () => {
    if (!currentUser) return;

    const trimmedName = profileNameDraft.trim();

    if (!trimmedName) {
      setAuthError('Your profile name cannot be empty.');
      return;
    }

    const updatedUser = {
      ...currentUser,
      name: trimmedName,
    };

    const storedUsers = JSON.parse(localStorage.getItem('soffy_movie_users') || '[]');
    const updatedUsers = storedUsers.map((user) =>
      user.email?.toLowerCase() === currentUser.email?.toLowerCase()
        ? { ...user, name: trimmedName }
        : user
    );

    localStorage.setItem('soffy_movie_users', JSON.stringify(updatedUsers));
    localStorage.setItem('soffy_movie_session', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setProfileNameDraft(trimmedName);
    setIsEditingProfileName(false);
    setAuthError('');
  };

  const profileActions = [
    {
      label: 'Profile',
      action: () => {
        setProfileMenuOpen(false);
        setProfilePageOpen(true);
      },
    },
    {
      label: 'Log out',
      action: handleLogout,
    },
  ];

  if (!currentUser) {
    return (
      <main className="welcome-shell">
        <nav className="welcome-topbar">
          <div className="welcome-brand">SOFFYFLIX</div>
          <button
            type="button"
            className="welcome-signin"
            onClick={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
          >
            Sign In
          </button>
        </nav>

        <div className="welcome-backdrop" />

        <div className="welcome-content welcome-simple-content">
          <p className="welcome-badge">Stream. Watch. Repeat.

          </p>

          <h1>
            Welcome 
          </h1>

          <p className="welcome-description">
            Discover blockbusters, thrillers, series, and top picks in one place.
            Create an account or log in to unlock your movie experience.
          </p>

          <div className="welcome-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setAuthMode('login');
                setAuthModalOpen(true);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setAuthMode('signup');
                setAuthModalOpen(true);
              }}
            >
              Create Account
            </button>
          </div>
        </div>

        {authModalOpen && (
          <div className="auth-modal-backdrop" onClick={closeAuthModal}>
            <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="close-video" onClick={closeAuthModal} aria-label="Close sign in">✕</button>

              <div className="auth-header">
                <h3>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
                <p>{authMode === 'login' ? 'Log in to watch movies and keep your list.' : 'Create an account to unlock streaming.'}</p>
              </div>

              <div className="auth-switcher">
                <button
                  type="button"
                  className={authMode === 'login' ? 'auth-switch active' : 'auth-switch'}
                  onClick={() => setAuthMode('login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === 'signup' ? 'auth-switch active' : 'auth-switch'}
                  onClick={() => setAuthMode('signup')}
                >
                  Create account
                </button>
              </div>

              <form className="auth-form" onSubmit={handleAuthSubmit}>
                {authMode === 'signup' && (
                  <label>
                    Full name
                    <input
                      type="text"
                      name="name"
                      value={authForm.name}
                      onChange={handleAuthInput}
                      placeholder="Jane Doe"
                    />
                  </label>
                )}

                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={authForm.email}
                    onChange={handleAuthInput}
                    placeholder="you@example.com"
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    value={authForm.password}
                    onChange={handleAuthInput}
                    placeholder="Enter at least 6 characters"
                  />
                </label>

                {authError && <p className="auth-error">{authError}</p>}

                <button type="submit" className="primary-btn auth-submit">
                  {authMode === 'login' ? 'Login' : 'Create account'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main>
      <div className="pattern"></div>

      <div className="wrapper">
        <header className="netflix-header">
          <div className="nav-bar">
            <div className="nav-brand">SOFFYFLIX</div>

            <nav className="nav-links" aria-label="Main menu">
              {navTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`nav-link ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedGenre(tab === 'My List' ? 'My List' : tab);
                  }}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <div className="profile-menu-wrap">
              <button
                type="button"
                className="profile-box"
                aria-label="Profile menu"
                onClick={() => {
                  if (currentUser) {
                    setProfileMenuOpen((prev) => !prev);
                  } else {
                    openAuthModal();
                  }
                }}
              >
                <span className="profile-pill">{currentUser ? currentUser.name.charAt(0).toUpperCase() : 'G'}</span>
                <span className="profile-label">{currentUser ? currentUser.name : 'Guest'}</span>
              </button>

              {currentUser && profileMenuOpen && (
                <div className="profile-dropdown">
                  {profileActions.map((item) => (
                    <button key={item.label} type="button" className="profile-dropdown-item" onClick={item.action}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="genre-toolbar" aria-label="Genre filters">
            {genreOptions.map((genre) => (
              <button
                key={genre}
                type="button"
                className={`genre-chip ${selectedGenre === genre ? 'active' : ''}`}
                onClick={() => {
                  setSelectedGenre(genre);
                  if (genre === 'Home' || genre === 'TV Shows' || genre === 'Movies') {
                    setActiveTab(genre);
                  }
                }}
              >
                {genre}
              </button>
            ))}
          </div>

          <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearch={handleSearchSubmit} />
        </header>

        {featuredMovie && (
          <section
            className="hero-section"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.75) 100%), url(https://image.tmdb.org/t/p/original/${featuredMovie.backdrop_path || featuredMovie.poster_path})`,
            }}
          >
            <div className="hero-content">
              <p className="hero-kicker">Now Playing</p>
              <h1>{featuredMovie.title}</h1>
              <div className="hero-meta">
                <span>PG-13</span>
                <span>{featuredMovie.release_date ? featuredMovie.release_date.split('-')[0] : 'N/A'}</span>
                <span>{featuredMovie.vote_average ? `${featuredMovie.vote_average.toFixed(1)} rating` : 'Top pick'}</span>
              </div>
              <p className="hero-overview">
                {featuredMovie.overview
                  ? featuredMovie.overview.slice(0, 180) + (featuredMovie.overview.length > 180 ? '...' : '')
                  : 'A thrilling movie experience you will want to watch again.'}
              </p>

              <div className="hero-actions">
                <button type="button" className="primary-btn" onClick={() => ensureSignedIn(() => watchMovie(featuredMovie))}>
                  ▶ Play
                </button>
                <button type="button" className="secondary-btn" onClick={() => ensureSignedIn(() => watchMovie(featuredMovie))}>
                  More Info
                </button>
                <button type="button" className="download-btn" onClick={() => toggleDownload(featuredMovie)}>
                  {isMovieDownloaded(featuredMovie.id) ? '✓ Downloaded' : '↓ Download'}
                </button>
              </div>
            </div>
          </section>
        )}

        {topTenMovies.length > 0 && (
          <section className="trending">
            <div className="row-header">
              <h2>Top 10 Movies</h2>
            </div>

            <ul className="top10-list">
              {topTenMovies.map((movie, index) => (
                <li key={movie.id || movie.$id} className="top10-item" onClick={() => ensureSignedIn(() => watchMovie(movie))}>
                  <span className="top10-rank">{index + 1}</span>
                  <img
                    src={
                      movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}`
                        : '/no-movie.png'
                    }
                    alt={movie.title}
                  />
                  <div className="top10-info">
                    <p>{movie.title}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {downloadedMovies.length > 0 && (
          <section className="netflix-row">
            <div className="row-header">
              <h2>Downloads</h2>
            </div>

            <div className="media-row">
              {downloadedMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="media-tile"
                  onClick={() => ensureSignedIn(() => watchMovie(movie))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      ensureSignedIn(() => watchMovie(movie));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Watch ${movie.title}`}
                >
                  <div className="media-poster">
                    <img
                      src={
                        movie.poster_path
                          ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}`
                          : '/no-movie.png'
                      }
                      alt={movie.title}
                    />
                    <span className="download-badge">↓</span>
                  </div>
                  <div className="media-meta">
                    <strong>{movie.title}</strong>
                    <span>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {visibleSections.map((section) => (
          <section key={section.title} className="netflix-row">
            <div className="row-header">
              <h2>{section.title}</h2>
            </div>

            <div className="media-row">
              {section.items.map((movie) => (
                <div
                  key={movie.id}
                  className="media-tile"
                  onClick={() => ensureSignedIn(() => watchMovie(movie))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      ensureSignedIn(() => watchMovie(movie));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Watch ${movie.title}`}
                >
                  <div className="media-poster">
                    <img
                      src={
                        movie.poster_path
                          ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}`
                          : '/no-movie.png'
                      }
                      alt={movie.title}
                    />
                    <span className="play-badge">▶</span>
                    <button
                      type="button"
                      className="mini-download-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDownload(movie);
                      }}
                      aria-label={isMovieDownloaded(movie.id) ? `Remove ${movie.title} from downloads` : `Download ${movie.title}`}
                    >
                      {isMovieDownloaded(movie.id) ? '✓' : '↓'}
                    </button>
                  </div>

                  <div className="media-meta">
                    <strong>{movie.title}</strong>
                    <span>
                      {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'} • {movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="All-movies">
          <div className="row-header">
            <h2>All Movies</h2>
          </div>

          {isloading ? (
            <Spinner />
          ) : errorMessage ? (
            <p className="text-white">{errorMessage}</p>
          ) : (
            <ul className="movie-grid">
              {filteredMovieList.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onWatch={(selectedMovie) => ensureSignedIn(() => watchMovie(selectedMovie))}
                  isDownloaded={isMovieDownloaded(movie.id)}
                  onDownload={toggleDownload}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {authModalOpen && (
        <div className="auth-modal-backdrop" onClick={closeAuthModal}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-video" onClick={closeAuthModal} aria-label="Close sign in" >✕</button>

            <div className="auth-header">
              <h3>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
              <p>{authMode === 'login' ? 'Log in to watch movies and keep your list.' : 'Create an account to unlock streaming.'}</p>
            </div>

            <div className="auth-switcher">
              <button
                type="button"
                className={authMode === 'login' ? 'auth-switch active' : 'auth-switch'}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'signup' ? 'auth-switch active' : 'auth-switch'}
                onClick={() => setAuthMode('signup')}
              >
                Create account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <label>
                  Full name
                  <input
                    type="text"
                    name="name"
                    value={authForm.name}
                    onChange={handleAuthInput}
                    placeholder="Jane Doe"
                  />
                </label>
              )}

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthInput}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthInput}
                  placeholder="Enter at least 6 characters"
                />
              </label>

              {authError && <p className="auth-error">{authError}</p>}

              <button type="submit" className="primary-btn auth-submit">
                {authMode === 'login' ? 'Login' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {profilePageOpen && (
        <div className="profile-page-backdrop" onClick={() => setProfilePageOpen(false)}>
          <div className="profile-page" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-video" onClick={() => setProfilePageOpen(false)} aria-label="Close profile page">
              ✕
            </button>

            <div className="profile-page-header">
              <span className="profile-pill profile-pill-large">{currentUser ? currentUser.name.charAt(0).toUpperCase() : 'G'}</span>
              <div className="profile-title-wrap">
                <p className="profile-page-label">Profile</p>
                {isEditingProfileName ? (
                  <div className="profile-name-editor">
                    <input
                      type="text"
                      value={profileNameDraft}
                      onChange={(event) => setProfileNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleProfileNameSave();
                        }
                      }}
                      placeholder="Enter your name"
                      className="profile-name-input"
                    />
                    <div className="profile-name-actions">
                      <button type="button" className="primary-btn profile-inline-button" onClick={handleProfileNameSave}>Save</button>
                      <button type="button" className="secondary-btn profile-inline-button" onClick={() => {
                        setProfileNameDraft(currentUser?.name || '');
                        setIsEditingProfileName(false);
                        setAuthError('');
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>{currentUser ? currentUser.name : 'Guest'}</h3>
                    <button type="button" className="secondary-btn profile-inline-button" onClick={() => {
                      setProfileNameDraft(currentUser?.name || '');
                      setIsEditingProfileName(true);
                      setAuthError('');
                    }}>
                      Edit name
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="profile-info-grid">
              <div className="profile-info-card">
                <span>Email</span>
                <strong>{currentUser ? currentUser.email : 'Not signed in'}</strong>
              </div>
              <div className="profile-info-card">
                <span>Plan</span>
                <strong>Premium</strong>
              </div>
              <div className="profile-info-card">
                <span>Downloads</span>
                <strong>{downloadedMovies.length}</strong>
              </div>
              <div className="profile-info-card">
                <span>Status</span>
                <strong>{currentUser ? 'Active member' : 'Guest'}</strong>
              </div>
            </div>

            <button type="button" className="primary-btn profile-page-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {selectedMovie && (
        <div className={`video-modal ${isFullScreen ? 'video-modal-fullscreen' : ''}`} onClick={closeMoviePlayer}>
          <div className={`video-modal-content ${isFullScreen ? 'video-modal-content-fullscreen' : ''}`} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-video" onClick={closeMoviePlayer} aria-label="Close video">
              ✕
            </button>

            <button type="button" className="fullscreen-toggle" onClick={toggleFullscreen}>
              {isFullScreen ? 'Exit full screen' : 'Full screen'}
            </button>

            <div className="movie-modal-header">
              <div className="movie-poster-box">
                <img
                  src={
                    selectedMovie.poster_path
                      ? `https://image.tmdb.org/t/p/w500/${selectedMovie.poster_path}`
                      : '/no-movie.png'
                  }
                  alt={selectedMovie.title}
                />
              </div>

              <div className="movie-details-copy">
                <h3>{selectedMovie.title}</h3>

                <div className="movie-meta">
                  <span>⭐ {selectedMovie.vote_average ? selectedMovie.vote_average.toFixed(1) : 'N/A'}</span>
                  <span>{selectedMovie.original_language ? selectedMovie.original_language.toUpperCase() : 'N/A'}</span>
                  <span>{selectedMovie.release_date ? selectedMovie.release_date.split('-')[0] : 'N/A'}</span>
                </div>

                <p className="movie-overview">
                  {selectedMovie.overview || 'No description available for this movie right now.'}
                </p>

                <div className="movie-player-actions">
                  <button type="button" className="primary-btn" onClick={() => ensureSignedIn(() => watchMovie(selectedMovie))}>
                    ▶ Play
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => toggleDownload(selectedMovie)}>
                    {isMovieDownloaded(selectedMovie.id) ? '✓ Downloaded' : '↓ Download'}
                  </button>
                </div>

              </div>
            </div>

            {selectedMovie ? (
              trailerKey ? (
                <iframe
                  key={`${selectedMovie.id}-trailer`}
                  className={`movie-video ${isFullScreen ? 'movie-video-fullscreen' : ''}`}
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&start=0&end=160`}
                  title={`${selectedMovie.title} trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : movieVideoSource ? (
                <video
                  key={selectedMovie.id}
                  className={`movie-video ${isFullScreen ? 'movie-video-fullscreen' : ''}`}
                  src={movieVideoSource}
                  poster={selectedMovie.poster_path ? `https://image.tmdb.org/t/p/w500/${selectedMovie.poster_path}` : '/no-movie.png'}
                  controls
                  autoPlay
                  muted={false}
                  playsInline
                  preload="metadata"
                  onError={() => setPlayerFailed(true)}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="video-fallback">
                  <p>This movie is not available yet.</p>
                  <p className="video-fallback-note">Add a licensed full movie file or stream URL to the app to play it here.</p>
                </div>
              )
            ) : (
              <div className="video-fallback">
                <p>No movie is available right now.</p>
                <p className="video-fallback-note">Add a licensed full movie file or stream URL to the app to play it here.</p>
              </div>
            )}

            {playerFailed && (
              <div className="video-fallback">
                <p>The movie player could not load in this browser.</p>
                <p className="video-fallback-note">Please try again or refresh the page.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default App

