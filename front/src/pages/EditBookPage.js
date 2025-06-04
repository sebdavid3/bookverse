
// src/pages/EditBookPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate,Link } from 'react-router-dom';
import axios from 'axios';
// import { useAuth } from '../context/AuthContext'; // Para permisos de admin
import './EditBookPage.css'; // Crearemos este archivo

function EditBookPage() {
  const { libroId } = useParams(); // El ID del libro a editar desde la URL
  const navigate = useNavigate();
  // const { currentUser } = useAuth(); // Para verificar roles

  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    isbn_api_externa: '',
    url_portada: '',
    descripcion_api: '',
    anio_publicacion: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos del libro a editar
  const fetchBookData = useCallback(async () => {
    // TODO: Protección de rol de admin aquí también
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/books/${libroId}`);
      const bookData = response.data;
      // Poblar el formulario, asegurando que los campos null/undefined sean strings vacíos para los inputs
      setFormData({
        titulo: bookData.titulo || '',
        autor: bookData.autor || '',
        isbn_api_externa: bookData.isbn_api_externa || '',
        url_portada: bookData.url_portada || '',
        descripcion_api: bookData.descripcion_api || '',
        anio_publicacion: bookData.anio_publicacion !== null ? String(bookData.anio_publicacion) : '',
      });
    } catch (err) {
      setError(err.response?.data?.error || "Error al cargar los datos del libro para editar.");
      console.error("Error fetching book for edit:", err);
    } finally {
      setLoading(false);
    }
  }, [libroId]);

  useEffect(() => {
    fetchBookData();
  }, [fetchBookData]);


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
      // Convertir año a número o null si está vacío
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
      // Remover campos vacíos para que no se envíen como strings vacías si se quieren poner a null
      // El backend debería manejar esto (ej. si autor es "", lo guarda como "" o lo convierte a null)
      // Opcionalmente, filtrar aquí:
      // for (const key in payload) {
      //   if (payload[key] === '') {
      //     payload[key] = null; 
      //   }
      // }

      const response = await axios.put(`/api/books/${libroId}`, payload, {
        withCredentials: true,
      });
      
      setSuccessMessage(`Libro "${response.data.book.titulo}" actualizado exitosamente!`);
      // Opcional: redirigir después de un tiempo o con un botón "Volver"
      // setTimeout(() => navigate(`/books/${libroId}`), 2000);

    } catch (err) {
      setError(err.response?.data?.error || "Error al actualizar el libro.");
      console.error("Error updating book:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="page-container"><p className="loading-message">Cargando datos del libro...</p></div>;
  }

  // Si hay un error al cargar y no hay datos en formData (ej. el libro no se encontró)
  if (error && !formData.titulo) {
     return <div className="page-container"><p className="form-error-message">{error}</p><Link to="/books" className="button button-secondary">Volver al catálogo</Link></div>;
  }


  return (
    <div className="page-container">
      <div className="edit-book-page form-container">
        <h2 className="page-title">Editar Libro: {formData.titulo || 'Cargando...'}</h2>
        <form onSubmit={handleSubmit}>
          {error && !successMessage && <p className="form-error-message">{error}</p>} {/* Mostrar error solo si no hay mensaje de éxito */}
          {successMessage && <p className="form-success-message">{successMessage}</p>}
          
          {/* Campos del formulario (iguales a AddBookPage, pero con values de formData) */}
          <div className="form-group">
            <label htmlFor="titulo">Título:</label>
            <input type="text" id="titulo" name="titulo" value={formData.titulo} onChange={handleChange} required disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="autor">Autor:</label>
            <input type="text" id="autor" name="autor" value={formData.autor} onChange={handleChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="isbn_api_externa">ISBN / ID API Externa:</label>
            <input type="text" id="isbn_api_externa" name="isbn_api_externa" value={formData.isbn_api_externa} onChange={handleChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="url_portada">URL de Portada:</label>
            <input type="url" id="url_portada" name="url_portada" value={formData.url_portada} onChange={handleChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="anio_publicacion">Año de Publicación:</label>
            <input type="number" id="anio_publicacion" name="anio_publicacion" value={formData.anio_publicacion} onChange={handleChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="descripcion_api">Descripción:</label>
            <textarea id="descripcion_api" name="descripcion_api" value={formData.descripcion_api} onChange={handleChange} rows="5" disabled={isSubmitting} />
          </div>
          
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" onClick={() => navigate(`/books/${libroId}`)} disabled={isSubmitting} className="button button-secondary">
              Cancelar / Volver
            </button>
            <button type="submit" disabled={isSubmitting} className="button button-primary">
              {isSubmitting ? "Actualizando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditBookPage;