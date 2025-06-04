// src/pages/BookDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios'; // O tu apiClient
import { useAuth } from '../context/AuthContext';
// Assuming you will create/use a CSS file for these new classes
import './BookDetailPage.css'; // Create this file and add styles for .page-container, .book-detail-page, etc.

function BookDetailPage() {
  const { bookId } = useParams();
  const { currentUser } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shelfMessage, setShelfMessage] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchBookDetails = async () => {
      setLoading(true);
      setShelfMessage('');
      try {
        const response = await axios.get(`/api/books/${bookId}`);
        setBook(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Error al obtener los detalles del libro");
        setBook(null);
        console.error("Error fetching book details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookDetails();
  }, [bookId]);

  const handleAddToShelf = async (estadoLectura) => {
    if (!currentUser) {
      setShelfMessage("Por favor, inicia sesión para añadir libros a tu estantería.");
      return;
    }
    if (!book) return;

    setIsAdding(true);
    setShelfMessage('');
    try {
      // eslint-disable-next-line no-unused-vars
      const response = await axios.post(
        '/api/shelves',
        { libro_id: book.libro_id, estado_lectura: estadoLectura },
        { withCredentials: true }
      );
      setShelfMessage(`'${book.titulo}' añadido a "${estadoLectura === 'QuieroLeer' ? 'Quiero Leer' : estadoLectura}"!`);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setShelfMessage(err.response.data.error || "Este libro ya está en tu estantería.");
      } else {
        setShelfMessage(err.response?.data?.error || "Error al añadir el libro a la estantería.");
      }
      console.error("Error adding to shelf:", err);
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    // You can wrap this in page-container as well if you want consistent styling for loading/error states
    return <div className="page-container"><p>Cargando detalles del libro...</p></div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <p style={{ color: 'red' }}>Error: {error} <Link to="/books">Volver a la lista</Link></p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="page-container">
        <p>Libro no encontrado. <Link to="/books">Volver a la lista</Link></p>
      </div>
    );
  }

  // Render book details using the new structure
  return (
    <div className="page-container book-detail-page">
      {book && (
        <>
          <div className="book-detail-content">
            <div className="book-cover-container">
              {book.url_portada ? (
                <img src={book.url_portada} alt={`Portada de ${book.titulo}`} />
              ) : (
                <div className="book-cover-placeholder">Sin portada</div>
              )}
            </div>
            <div className="book-info-main">
              <h2>{book.titulo}</h2>
              <p className="book-author">Por: {book.autor || 'Desconocido'}</p>
              <p className="book-meta-item"><strong>Año:</strong> {book.anio_publicacion || 'N/A'}</p>
              <p className="book-meta-item"><strong>ISBN/ID API:</strong> {book.isbn_api_externa || 'N/A'}</p>
              {/* Puedes añadir más metadatos aquí si los tienes, como género, etc. */}
            </div>
          </div>

          {book.descripcion_api && (
             <section className="book-description-section">
                 <h3>Descripción</h3>
                 <p>{book.descripcion_api}</p>
             </section>
          )}
          {!book.descripcion_api && (
            <section className="book-description-section">
                <h3>Descripción</h3>
                <p>No hay descripción disponible para este libro.</p>
            </section>
          )}

          {currentUser && (
            <div className="add-to-shelf-actions">
              <h3>Añadir a mi estantería:</h3>
              <div className="button-group">
                 <button 
                    onClick={() => handleAddToShelf('QuieroLeer')} 
                    disabled={isAdding} 
                    className="button button-primary" // Added button-primary for potential default styling
                 >
                    Quiero Leer
                 </button>
                 <button 
                    onClick={() => handleAddToShelf('Leyendo')} 
                    disabled={isAdding} 
                    className="button button-secondary" // Added button-secondary
                 >
                    Estoy Leyendo
                 </button>
                 <button 
                    onClick={() => handleAddToShelf('Leido')} 
                    disabled={isAdding} 
                    className="button button-success" // Added button-success
                 >
                    Ya lo Leí
                 </button>
              </div>
              {isAdding && <p className="shelf-action-message loading">Añadiendo...</p>}
              {shelfMessage && !isAdding && (
                <p className={`shelf-action-message ${
                    shelfMessage.toLowerCase().includes("error") || shelfMessage.toLowerCase().includes("ya está") 
                    ? 'error' 
                    : 'success'
                }`}>
                    {shelfMessage}
                </p>
              )}
            </div>
          )}
          
          <Link to="/books" className="back-to-list-link button button-outline">Volver a la lista de libros</Link>
        </>
      )}
    </div>
  );
}

export default BookDetailPage;