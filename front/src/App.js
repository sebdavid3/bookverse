// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import axios from 'axios';

// Importar páginas
import HomePage from './pages/HomePage';
import MyShelfPage from './pages/MyShelfPage';
import BookDetailPage from './pages/BookDetailPage';
import ClubListPage from './pages/ClubListPage';
import ClubDetailPage from './pages/ClubDetailPage';
import CreateClubPage from './pages/CreateClubPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import AddBookPage from './pages/AddBookPage';
import EditBookPage from './pages/EditBookPage';

// Importar componentes de formulario
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';

// Estilos globales de la aplicación
import './App.css';

function BookListDisplay() {
  const [books, setBooks] = React.useState([]);
  const [loadingBooks, setLoadingBooks] = React.useState(true);
  const [errorBooks, setErrorBooks] = React.useState(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const isSiteAdmin = currentUser && (currentUser.username === 'admin' || currentUser.email === 'admin@example.com');

  React.useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoadingBooks(true);
        const apiUrl = searchTerm ? `/api/books?search=${encodeURIComponent(searchTerm)}` : '/api/books';
        const response = await axios.get(apiUrl);
        setBooks(response.data || []);
        setErrorBooks(null);
      } catch (err) {
        setErrorBooks(err.message || "Error al obtener los libros");
        setBooks([]);
      } finally {
        setLoadingBooks(false);
      }
    };
    fetchBooks();
  }, [searchTerm]);

  const handleDeleteBook = async (libroId, libroTitulo) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el libro "${libroTitulo}"? Esta acción no se puede deshacer.`)) {
      try {
        await axios.delete(`/api/books/${libroId}`, { withCredentials: true });
        setBooks(prevBooks => prevBooks.filter(b => b.libro_id !== libroId));
        alert(`Libro "${libroTitulo}" eliminado exitosamente.`);
      } catch (err) {
        console.error("Error deleting book:", err);
        alert(err.response?.data?.error || `Error al eliminar el libro "${libroTitulo}".`);
      }
    }
  };

  if (loadingBooks && !searchTerm) {
    return <div className="page-container"><p className="loading-message">Cargando catálogo de libros...</p></div>;
  }
  if (errorBooks && !searchTerm) {
    return <div className="page-container"><p className="form-error-message">Error al cargar libros: {errorBooks}</p></div>;
  }

  return (
    <div className="page-container book-list-page-container">
      <div className="page-header-actions">
        <h2 className="page-title">Explora Nuestro Catálogo de Libros</h2>
      </div>

      <div className="form-group" style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Buscar libros por título o autor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input-books form-input"
        />
        {loadingBooks && searchTerm && <p className="loading-message" style={{fontSize: '0.9em', marginTop: '0.5em'}}>Buscando...</p>}
        {errorBooks && searchTerm && <p className="form-error-message" style={{fontSize: '0.9em', marginTop: '0.5em'}}>Error en la búsqueda: {errorBooks}</p>}
      </div>

      {books.length > 0 ? (
        <div className="book-list-grid">
          {books.map(book => (
            <div key={book.libro_id} className="book-card">
              <Link to={`/books/${book.libro_id}`} className="book-card-link">
                <div className="book-card-image-wrapper">
                  {book.url_portada ? (
                      <img src={book.url_portada} alt={book.titulo} className="book-card-image" />
                  ) : (
                    <div className="book-card-image-placeholder">
                      <span>{book.titulo ? book.titulo.charAt(0) : '?'}</span>
                    </div>
                  )}
                </div>
                <div className="book-card-content">
                    <h3 className="book-card-title">{book.titulo}</h3>
                    <p className="book-card-author">Por: {book.autor || "Desconocido"}</p>
                </div>
              </Link>
              {isSiteAdmin && (
                <div className="book-card-actions">
                  <button
                    onClick={() => navigate(`/admin/edit-book/${book.libro_id}`)}
                    className="button button-edit"
                    title="Editar libro"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteBook(book.libro_id, book.titulo)}
                    className="button button-delete"
                    title="Eliminar libro"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !loadingBooks && (
            searchTerm
            ? <p className="info-message">No se encontraron libros para "{searchTerm}".</p>
            : <p className="info-message">No hay libros disponibles en el catálogo en este momento.</p>
        )
      )}
    </div>
  );
}


function ProtectedRoute({ children }) {
  const { currentUser, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return <div className="page-container"><p className="loading-message">Cargando autenticación...</p></div>;
  }
  if (!currentUser) {
    return <Navigate to={`/login?redirect=${window.location.pathname}${window.location.search}`} replace />;
  }
  return children;
}


function App() {
  const { currentUser, logout, isLoadingAuth } = useAuth();
  const isSiteAdmin = currentUser && (currentUser.username === 'admin' || currentUser.email === 'admin@example.com');

  if (isLoadingAuth) {
    return <div className="app-loading-fullscreen"><p>Cargando BookVerse...</p></div>;
  }

  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <Link to="/" className="logo-link"><h1>BookVerse</h1></Link>
          <nav className="app-nav">
            <Link to="/books">Libros</Link>
            <Link to="/clubs">Clubes</Link>
            {currentUser ? (
              <>
                <Link to="/my-shelf">Mi Estantería</Link>
                {isSiteAdmin && <Link to="/admin/add-book" className="nav-button admin-link">Añadir Libro</Link>}
                <span className="user-greeting">Hola, {currentUser.username}!</span>
                <button onClick={logout} className="nav-button logout-button">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-button">Iniciar Sesión</Link>
                <Link to="/register" className="nav-button">Registrarse</Link>
              </>
            )}
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={currentUser ? <Navigate to="/" /> : <LoginForm />} />
            <Route path="/register" element={currentUser ? <Navigate to="/" /> : <RegisterForm />} />
            <Route path="/books" element={<BookListDisplay />} />
            <Route path="/books/:bookId" element={<BookDetailPage />} />
            <Route path="/clubs" element={<ClubListPage />} />
            <Route path="/clubs/create" element={ <ProtectedRoute><CreateClubPage /></ProtectedRoute> } />
            <Route path="/clubs/:clubId" element={<ClubDetailPage />} />
            <Route path="/clubs/:clubId/discussions/:threadId" element={<ThreadDetailPage />} />
            <Route
              path="/my-shelf"
              element={ <ProtectedRoute><MyShelfPage /></ProtectedRoute> }
            />
            <Route
              path="/admin/add-book"
              element={
                <ProtectedRoute>
                  {isSiteAdmin ? <AddBookPage /> : <Navigate to="/" replace />}
                </ProtectedRoute>
              }
            />
            {/* Using :libroId as per your snippet and BookListDisplay navigation */}
            <Route
              path="/admin/edit-book/:libroId" 
              element={
                <ProtectedRoute>
                  {isSiteAdmin ? <EditBookPage /> : <Navigate to="/" replace />}
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<div className="page-container text-center-content"><h2 className="page-title">404 - Página No Encontrada</h2><Link to="/" className="button button-primary">Ir al inicio</Link></div>} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>
            © {new Date().getFullYear()} {/* Mantienes el año dinámico */}
            <a href="https://github.com/AlexDanii" target="_blank" rel="noopener noreferrer">
              Daniel Cruzado
            </a>
            , {} {/* Esto es para el espacio y la coma, si quieres mantenerlo */}
            <a href="https://github.com/sebdavid3" target="_blank" rel="noopener noreferrer">
              Sebastian Ibañez
            </a>
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;