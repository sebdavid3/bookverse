// src/pages/CreateClubPage.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios'; // O tu apiClient
import { useAuth } from '../context/AuthContext';
import './CreateClubPage.css'; // Import the CSS file

function CreateClubPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [nombreClub, setNombreClub] = useState('');
  const [descripcionClub, setDescripcionClub] = useState('');
  const [esPublico, setEsPublico] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setError("Debes iniciar sesión para crear un club.");
      return;
    }
    if (!nombreClub.trim()) {
        setError("El nombre del club es requerido.");
        return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const response = await axios.post('/api/clubs', 
        { nombre_club: nombreClub, descripcion_club: descripcionClub, es_publico: esPublico },
        { withCredentials: true }
      );
      navigate(`/clubs/${response.data.club.club_id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Error al crear el club.");
      console.error("Error creating club:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // The ProtectedRoute component in App.js should handle this,
  // but this is an additional in-component check.
  if (!currentUser && !isSubmitting) { // Only show prompt if not in submission process (to avoid flash)
    return (
        <div className="page-container create-club-page"> {/* Added page-container for consistency */}
            <div className="login-prompt">
                <p>Debes <Link to={`/login?redirect=/clubs/create`}>iniciar sesión</Link> para crear un club.</p>
            </div>
        </div>
    );
  }

  return (
    // Assuming .page-container and .form-container are global or defined in App.css
    <div className="page-container create-club-page"> 
      <form onSubmit={handleSubmit} className="form-container"> {/* Apply .form-container */}
        <h2 className="page-title">Crear Nuevo Club de Lectura</h2> {/* page-title for styling */}
        
        {error && <p className="form-error-message">{error}</p>} {/* form-error-message for styling */}
        
        <div className="form-group"> {/* Apply .form-group */}
          <label htmlFor="nombreClub">Nombre del Club:</label>
          <input
            type="text"
            id="nombreClub"
            className="form-input" // Assuming global .form-input
            value={nombreClub}
            onChange={(e) => setNombreClub(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div className="form-group"> {/* Apply .form-group */}
          <label htmlFor="descripcionClub">Descripción (opcional):</label>
          <textarea
            id="descripcionClub"
            className="form-input" // Assuming global .form-input
            value={descripcionClub}
            onChange={(e) => setDescripcionClub(e.target.value)}
            rows="4" // Default, CSS will adjust min-height
            disabled={isSubmitting}
          />
        </div>
        
        <div className="form-group checkbox-group"> {/* Apply .form-group and .checkbox-group */}
          <label htmlFor="esPublico"> {/* htmlFor for accessibility */}
            <input
              type="checkbox"
              id="esPublico" // Match label's htmlFor
              checked={esPublico}
              onChange={(e) => setEsPublico(e.target.checked)}
              disabled={isSubmitting}
            />
            Club Público (cualquiera puede verlo y unirse)
          </label>
        </div>
        
        <div className="form-actions"> {/* Apply .form-actions */}
            <button type="submit" disabled={isSubmitting} className="button button-primary">
            {isSubmitting ? "Creando..." : "Crear Club"}
            </button>
        </div>
      </form>
    </div>
  );
}

export default CreateClubPage;