// src/pages/ClubListPage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios'; // O tu apiClient
import './ClubListPage.css'; // Import the CSS file with the "ClubDetailPage" styles

function ClubListPage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClubs = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/clubs'); // Endpoint para obtener clubes públicos
        setClubs(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Error al obtener los clubes");
        setClubs([]);
        console.error("Error fetching clubs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  }, []);

  if (loading) {
    // Assuming .page-container and .loading-message are global
    return <div className="page-container"><p className="loading-message">Cargando clubes de lectura...</p></div>;
  }

  if (error) {
    return <div className="page-container"><p className="error-message page-level">{error}</p></div>;
  }

  return (
    // Assuming .page-container is global
    <div className="page-container club-list-page"> 
      <div className="page-header-actions"> {/* Using a class from the previous ClubListPage.css for layout */}
        <h2 className="page-title">Clubes de Lectura Públicos</h2>
        <div className="create-club-link-container">  {/* Using a class from the previous ClubListPage.css for layout */}
          <Link to="/clubs/create" className="button button-primary">Crear Nuevo Club</Link> 
          {/* Assuming global button styles */}
        </div>
      </div>

      {clubs.length === 0 ? (
        <p className="info-message">No hay clubes públicos disponibles en este momento.</p>
      ) : (
        // Applying discussion-list class here, as it uses grid
        <div className="discussion-list"> 
          {clubs.map(club => (
            // Each club will be styled as a discussion-thread-card
            <div key={club.club_id} className="discussion-thread-card">
              <h3 className="discussion-thread-card__title">
                <Link to={`/clubs/${club.club_id}`}>{club.nombre_club}</Link>
              </h3>
              <p className="discussion-thread-card__content-preview">
                {club.descripcion_club || "Sin descripción."}
              </p>
              <small className="discussion-thread-card__meta">
                Creado por: {club.creador_username || "Desconocido"} el {new Date(club.fecha_creacion).toLocaleDateString()}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClubListPage;