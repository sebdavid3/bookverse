// src/pages/AddBookPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// import { useAuth } from '../context/AuthContext'; // Descomenta si necesitas verificar roles específicos de currentUser
import './AddBookPage.css'; // Crearemos este archivo CSS

function AddBookPage() {
  // const { currentUser } = useAuth(); // Para verificar roles de admin de sitio en el futuro
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    isbn_api_externa: '', // Este campo es para el ID de una API externa si lo tienes
    url_portada: '',
    descripcion_api: '', // O simplemente 'descripcion'
    anio_publicacion: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // En una aplicación real, protegerías esta página para que solo administradores del sitio puedan acceder.
  // El <ProtectedRoute> en App.js ya maneja el login, pero para roles necesitarías más lógica.
  // Ejemplo:
  // useEffect(() => {
  //   if (!currentUser || !currentUser.isSiteAdmin) { // Asumiendo que tienes currentUser.isSiteAdmin
  //     navigate('/', { replace: true }); // Redirigir si no es admin del sitio
  //   }
  // }, [currentUser, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!formData.titulo.trim()) {
      setError("El título es requerido.");
      return;
    }
    setIsSubmitting(true);

    try {
      const payload = { ...formData };
      if (payload.anio_publicacion === '' || payload.anio_publicacion === null) {
        payload.anio_publicacion = null;
      } else {
        const year = parseInt(payload.anio_publicacion, 10);
        if (isNaN(year)) {
            setError("El año de publicación debe ser un número válido.");
            setIsSubmitting(false);
            return;
        }
        payload.anio_publicacion = year;
      }

      // El backend espera 'descripcion_api' y 'isbn_api_externa'
      // Si tus campos en el formulario tienen otros nombres, ajústalos aquí o en el backend
      const response = await axios.post('/api/books', payload, { // Endpoint para añadir libro a TU BD
        withCredentials: true, 
      });
      
      setSuccessMessage(`Libro "${response.data.book.titulo}" añadido exitosamente al catálogo! ID: ${response.data.book.libro_id}`);
      setFormData({
        titulo: '', autor: '', isbn_api_externa: '',
        url_portada: '', descripcion_api: '', anio_publicacion: '',
      });
      // Opcional: Redirigir
      // setTimeout(() => navigate(`/books/${response.data.book.libro_id}`), 2000);

    } catch (err) {
      setError(err.response?.data?.error || "Error al añadir el libro al catálogo.");
      console.error("Error adding book to catalog:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="add-book-page form-container"> {/* Usa clases globales y específicas */}
        <h2 className="page-title">Añadir Nuevo Libro al Catálogo</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="form-error-message">{error}</p>}
          {successMessage && <p className="form-success-message">{successMessage}</p>}
          
          <div className="form-group">
            <label htmlFor="titulo">Título:</label>
            <input type="text" id="titulo" name="titulo" value={formData.titulo} onChange={handleChange} required disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="autor">Autor:</label>
            <input type="text" id="autor" name="autor" value={formData.autor} onChange={handleChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="isbn_api_externa">ISBN / ID API Externa (opcional):</label>
            <input type="text" id="isbn_api_externa" name="isbn_api_externa" value={formData.isbn_api_externa} onChange={handleChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="url_portada">URL de Portada (opcional):</label>
            <input type="url" id="url_portada" name="url_portada" value={formData.url_portada} onChange={handleChange} disabled={isSubmitting} placeholder="https://ejemplo.com/portada.jpg"/>
          </div>
          <div className="form-group">
            <label htmlFor="anio_publicacion">Año de Publicación (opcional):</label>
            <input type="number" id="anio_publicacion" name="anio_publicacion" value={formData.anio_publicacion} onChange={handleChange} placeholder="Ej: 1984" disabled={isSubmitting} min="0" max={new Date().getFullYear() + 5} />
          </div>
          <div className="form-group">
            <label htmlFor="descripcion_api">Descripción (opcional):</label>
            <textarea id="descripcion_api" name="descripcion_api" value={formData.descripcion_api} onChange={handleChange} rows="5" disabled={isSubmitting} />
          </div>
          
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting} className="button button-primary">
              {isSubmitting ? "Añadiendo Libro..." : "Añadir Libro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddBookPage;