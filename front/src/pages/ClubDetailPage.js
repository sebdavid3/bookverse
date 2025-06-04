// src/pages/ClubDetailPage.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './ClubDetailPage.css'; // Import the new CSS file

function ClubDetailPage() {
  const { clubId } = useParams();
  const { currentUser } = useAuth();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [joinMessage, setJoinMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isAdminOfCurrentClub, setIsAdminOfCurrentClub] = useState(false);

  const [allClubDiscussions, setAllClubDiscussions] = useState([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [discussionsError, setDiscussionsError] = useState(null);

  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadIsAnnouncement, setNewThreadIsAnnouncement] = useState(false);
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);
  const [threadCreationError, setThreadCreationError] = useState('');

  const [assignBookSearchTerm, setAssignBookSearchTerm] = useState('');
  const [assignBookSearchResults, setAssignBookSearchResults] = useState([]);
  const [loadingAssignBookSearch, setLoadingAssignBookSearch] = useState(false);
  const [selectedBookToAssign, setSelectedBookToAssign] = useState(null);
  const [isAssigningBook, setIsAssigningBook] = useState(false);
  const [assignBookMessage, setAssignBookMessage] = useState('');

  const fetchClubDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/clubs/${clubId}`);
      if (response.data && typeof response.data === 'object' && response.data.club_id) {
        setClub(response.data);
        if (currentUser && response.data.miembros) {
          const membership = response.data.miembros.find(member => member.user_id === currentUser.user_id);
          setIsMember(!!membership);
          const isAdmin = membership && membership.rol_en_club === 'Admin';
          setIsAdminOfCurrentClub(isAdmin);
        } else {
          setIsMember(false);
          setIsAdminOfCurrentClub(false);
        }
      } else {
        throw new Error("Club no encontrado o formato de datos incorrecto.");
      }
    } catch (err) {
      console.error("Error fetching club details:", err);
      setError(err.response?.data?.error || err.message || "Error al obtener los detalles del club");
      setClub(null);
      setIsMember(false);
      setIsAdminOfCurrentClub(false);
    } finally {
      setLoading(false);
    }
  }, [clubId, currentUser]);

  useEffect(() => {
    fetchClubDetails();
  }, [fetchClubDetails]);

  useEffect(() => {
    if (!isAdminOfCurrentClub || assignBookSearchTerm.trim().length < 2 || selectedBookToAssign) {
      setAssignBookSearchResults([]);
      setLoadingAssignBookSearch(false);
      return;
    }
    setLoadingAssignBookSearch(true);
    const timerId = setTimeout(async () => {
      try {
        const response = await axios.get(`/api/external-books/search?q=${encodeURIComponent(assignBookSearchTerm)}`);
        setAssignBookSearchResults(response.data || []);
      } catch (error) {
        console.error("Error searching external books to assign:", error);
        setAssignBookSearchResults([]);
      } finally {
        setLoadingAssignBookSearch(false);
      }
    }, 700);
    return () => clearTimeout(timerId);
  }, [assignBookSearchTerm, isAdminOfCurrentClub, selectedBookToAssign]);

  useEffect(() => {
    const fetchAllClubDiscussions = async () => {
      if (!club || !isMember) {
        setAllClubDiscussions([]);
        setLoadingDiscussions(false);
        return;
      }
      setLoadingDiscussions(true);
      setDiscussionsError(null);
      try {
        const response = await axios.get(`/api/clubs/${clubId}/discussions`);
        setAllClubDiscussions(response.data || []);
      } catch (err) {
        console.error("Error fetching all club discussions:", err);
        setDiscussionsError(err.response?.data?.error || "Error al cargar las discusiones del club.");
        setAllClubDiscussions([]);
      } finally {
        setLoadingDiscussions(false);
      }
    };

    if (club && isMember) {
      fetchAllClubDiscussions();
    } else {
      setAllClubDiscussions([]);
    }
  }, [club, clubId, isMember]);

  const handleJoinClub = async () => {
    if (!currentUser) {
      setJoinMessage("Debes iniciar sesión para unirte a un club.");
      return;
    }
    setIsJoining(true);
    setJoinMessage('');
    try {
      await axios.post(`/api/clubs/${clubId}/join`, {}, { withCredentials: true });
      setJoinMessage("¡Te has unido al club exitosamente!");
      setIsMember(true);
      fetchClubDetails();
    } catch (err) {
      setJoinMessage(err.response?.data?.error || "Error al unirse al club.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateNewThread = async (event) => {
    event.preventDefault();
    setThreadCreationError('');
    if (!newThreadTitle.trim()) {
      setThreadCreationError("El título del hilo es requerido.");
      return;
    }
    if (!club || !club.libro_actual) {
      setThreadCreationError("Se debe asignar un libro actual al club para crear nuevos hilos sobre él.");
      return;
    }
    if (!isMember) {
      setThreadCreationError("Debes ser miembro para crear un hilo.");
      return;
    }
    if (newThreadIsAnnouncement && !isAdminOfCurrentClub) {
      setThreadCreationError("Solo los administradores pueden crear anuncios.");
      return;
    }

    setIsSubmittingThread(true);
    try {
      const response = await axios.post(
        `/api/clubs/${clubId}/discussions`,
        {
          titulo_hilo: newThreadTitle,
          contenido_inicial_hilo: newThreadContent,
          es_anuncio: newThreadIsAnnouncement
        },
        { withCredentials: true }
      );
      setAllClubDiscussions(prevDiscussions => [response.data.hilo, ...prevDiscussions].sort((a,b) => (b.es_anuncio - a.es_anuncio) || (new Date(b.fecha_creacion_hilo) - new Date(a.fecha_creacion_hilo))));
      setNewThreadTitle('');
      setNewThreadContent('');
      setNewThreadIsAnnouncement(false);
      setShowNewThreadForm(false);
    } catch (err) {
      setThreadCreationError(err.response?.data?.error || "Error al crear el hilo.");
      console.error("Error creating thread:", err);
    } finally {
      setIsSubmittingThread(false);
    }
  };

  const handleAssignBookOfTheMonth = async () => {
    if (!selectedBookToAssign || !selectedBookToAssign.external_api_id) {
      setAssignBookMessage("Por favor, busca y selecciona un libro de la lista de resultados.");
      return;
    }
    if (!isAdminOfCurrentClub) {
      setAssignBookMessage("No tienes permiso para esta acción.");
      return;
    }

    setIsAssigningBook(true);
    setAssignBookMessage('');
    try {
      const importResponse = await axios.post(
        '/api/books/from-external',
        selectedBookToAssign,
        { withCredentials: true }
      );

      const localBook = importResponse.data.book;
      if (!localBook || !localBook.libro_id) {
        throw new Error("No se pudo obtener el ID local del libro desde el backend.");
      }

      await axios.post(
        `/api/clubs/${clubId}/assign-book`,
        { libro_id: localBook.libro_id },
        { withCredentials: true }
      );

      setAssignBookMessage(`'${selectedBookToAssign.titulo}' asignado como libro del mes.`);
      fetchClubDetails();
      setAssignBookSearchTerm('');
      setAssignBookSearchResults([]);
      setSelectedBookToAssign(null);
    } catch (err) {
      setAssignBookMessage(err.response?.data?.error || "Error al asignar el libro del mes.");
      console.error("Error assigning book of the month:", err);
    } finally {
      setIsAssigningBook(false);
    }
  };

  const discussionsGroupedByBook = useMemo(() => {
    if (!allClubDiscussions || allClubDiscussions.length === 0) return {};
    return allClubDiscussions.reduce((acc, thread) => {
      const bookKey = thread.libro_id_asociado || 'general';
      if (!acc[bookKey]) {
        acc[bookKey] = {
          libro_titulo: thread.libro_titulo_asociado || 'Discusiones Generales',
          libro_id: thread.libro_id_asociado,
          es_libro_actual: club?.libro_actual?.libro_id === thread.libro_id_asociado,
          hilos: []
        };
      }
      if (club?.libro_actual?.libro_id === thread.libro_id_asociado) {
         acc[bookKey].es_libro_actual = true;
      }
      acc[bookKey].hilos.push(thread);
      acc[bookKey].hilos.sort((a,b) => (b.es_anuncio - a.es_anuncio) || (new Date(b.fecha_creacion_hilo) - new Date(a.fecha_creacion_hilo)));
      return acc;
    }, {});
  }, [allClubDiscussions, club?.libro_actual?.libro_id]);

  const sortedBookGroups = useMemo(() => {
    return Object.values(discussionsGroupedByBook).sort((a, b) => {
        if (a.es_libro_actual && !b.es_libro_actual) return -1;
        if (!a.es_libro_actual && b.es_libro_actual) return 1;
        // Sort "Discusiones Generales" to appear last if not current book
        if (a.libro_id === null && b.libro_id !== null) return 1;
        if (a.libro_id !== null && b.libro_id === null) return -1;
        return (a.libro_titulo || '').localeCompare(b.libro_titulo || '');
    });
  }, [discussionsGroupedByBook]);

  if (loading) { return <div className="page-container"><p className="loading-message">Cargando detalles del club...</p></div>; }
  if (error) { return ( <div className="page-container"><p className="error-message page-level">Error: {error}</p><Link to="/clubs" className="button button-outline">Volver a la lista de clubes</Link></div> ); }
  if (!club || typeof club !== 'object' || !club.club_id) { return ( <div className="page-container"><p className="info-message">Club no encontrado o datos inválidos.</p><Link to="/clubs" className="button button-outline">Volver a la lista de clubes</Link></div> ); }

  const getJoinMessageClass = () => {
    if (!joinMessage) return '';
    if (joinMessage.toLowerCase().includes("error") || joinMessage.toLowerCase().includes("ya eres")) return 'error';
    return 'success';
  }

  return (
    <div className="page-container club-detail-page"> {/* Assuming .page-container is global */}
      <h2 className="page-title">{club.nombre_club}</h2>
      <div className="club-info-basic">
        <p><strong>Descripción:</strong> {club.descripcion_club || "N/A"}</p>
        <p><small>Creado por: {club.creador_username || "Desconocido"} el {new Date(club.fecha_creacion).toLocaleDateString()}</small></p>
        <p><small>Público: {club.es_publico ? "Sí" : "No"}</small></p>
      </div>

      <div className="join-message-area">
        {joinMessage && <p className={`status-message ${getJoinMessageClass()}`}>{joinMessage}</p>}
        
        {currentUser && !isMember && club.es_publico && (
          <button onClick={handleJoinClub} disabled={isJoining} className="button button-primary">
            {isJoining ? "Uniéndose..." : "Unirse al Club"}
          </button>
        )}
      </div>
      
      {currentUser && isMember && !joinMessage && <p className="status-message success">Ya eres miembro de este club.</p>}
      
      {!currentUser && club.es_publico && (
        <p className="info-message"><Link to={`/login?redirect=/clubs/${clubId}`}>Inicia sesión</Link> para unirte a este club.</p>
      )}
      {!club.es_publico && !isMember && <p className="info-message">Este es un club privado. Se requiere invitación para unirse.</p>}


      {isAdminOfCurrentClub && (
        <section className="admin-actions-section panel-section">
          <h3>Panel de Administración del Club</h3>
          <div className="form-group"> {/* Assuming .form-group is global */}
            <label htmlFor="assignBookSearchInput">Asignar/Cambiar Libro del Mes (Búsqueda Externa):</label>
            <input
              type="text"
              id="assignBookSearchInput"
              className="form-input" // Assuming global .form-input
              placeholder="Busca en API externa por título o autor..."
              value={assignBookSearchTerm}
              onChange={(e) => {
                setAssignBookSearchTerm(e.target.value);
                setSelectedBookToAssign(null);
                setAssignBookMessage(''); 
              }}
              disabled={isAssigningBook}
            />
            {loadingAssignBookSearch && <p className="loading-message small">Buscando libros...</p>}
            
            {assignBookSearchResults.length > 0 && !selectedBookToAssign && (
              <ul className="book-search-results-for-admin">
                {assignBookSearchResults.map(book => (
                  <li
                    key={book.external_api_id}
                    onClick={() => {
                      setSelectedBookToAssign(book);
                      setAssignBookSearchTerm(book.titulo); 
                      setAssignBookSearchResults([]); 
                    }}
                  >
                    {book.titulo} {book.autor ? `(Por: ${book.autor})` : ''}
                    {book.anio_publicacion && book.anio_publicacion !== 'N/A' ? ` (${book.anio_publicacion})` : ''}
                  </li>
                ))}
              </ul>
            )}

            {selectedBookToAssign && (
              <div className="selected-book-to-assign">
                <strong>Libro Seleccionado:</strong> {selectedBookToAssign.titulo}
                {selectedBookToAssign.autor && ` por ${selectedBookToAssign.autor}`}
                <button 
                    onClick={() => {setSelectedBookToAssign(null); setAssignBookSearchTerm(''); setAssignBookMessage('');}}
                    className="button button-secondary button-small" /* Assuming global button styles */
                    style={{ marginLeft: '10px'}}
                >
                  Limpiar
                </button>
              </div>
            )}
            
            <div className="form-actions" style={{marginTop: '1rem'}}> {/* Assuming global .form-actions */}
                <button
                onClick={handleAssignBookOfTheMonth}
                disabled={isAssigningBook || !selectedBookToAssign}
                className="button button-primary"
                >
                {isAssigningBook ? "Asignando..." : "Asignar Libro Seleccionado"}
                </button>
            </div>
            {assignBookMessage && <p className={`status-message ${assignBookMessage.toLowerCase().includes("error") ? 'error' : 'success'}`}>{assignBookMessage}</p>}
          </div>
        </section>
      )}

      <section className="current-book-section panel-section">
        <h3>Libro del Mes Actual</h3>
        {club.libro_actual ? (
          <div className="book-info">
            <h4><Link to={`/books/${club.libro_actual.libro_id}`}>{club.libro_actual.titulo}</Link></h4>
            <p><strong>Autor:</strong> {club.libro_actual.autor || "N/A"}</p>
            {club.libro_actual.url_portada && <img src={club.libro_actual.url_portada} alt={`Portada de ${club.libro_actual.titulo}`}/>}
            <p><strong>Año:</strong> {club.libro_actual.anio_publicacion || "N/A"}</p>
          </div>
        ) : (
          <>
            <p className="info-message">Aún no se ha asignado un libro del mes para este club.</p>
            {isAdminOfCurrentClub && <p>Como administrador, puedes asignar uno desde el panel de administración.</p>}
            {!isAdminOfCurrentClub && isMember && <p>Pronto el administrador del club asignará un libro.</p>}
          </>
        )}
      </section>

      {isMember && (
        <section className="discussions-section panel-section">
          <h3>Discusiones del Club</h3>
          
          {club.libro_actual && (
            <>
              {!showNewThreadForm && (
                <button 
                    onClick={() => setShowNewThreadForm(true)} 
                    className="button button-primary" /* Assuming global button styles */
                    style={{ marginBottom: '1.5rem' }}
                >
                  Crear Nuevo Hilo (sobre "{club.libro_actual.titulo}")
                </button>
              )}
              {showNewThreadForm && (
                <form onSubmit={handleCreateNewThread} className="new-thread-form form-container"> {/* Assuming global .form-container */}
                  <h4>Crear Nuevo Hilo sobre "{club.libro_actual.titulo}"</h4>
                   {threadCreationError && <p className="form-error-message">{threadCreationError}</p>}
                  <div className="form-group"> {/* Assuming global .form-group */}
                    <label htmlFor="newThreadTitle">Título del Hilo:</label>
                    <input type="text" id="newThreadTitle" className="form-input" value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} required disabled={isSubmittingThread}/>
                  </div>
                  <div className="form-group">
                    <label htmlFor="newThreadContent">Contenido Inicial (opcional):</label>
                    <textarea id="newThreadContent" className="form-input" value={newThreadContent} onChange={(e) => setNewThreadContent(e.target.value)} rows="4" disabled={isSubmittingThread}/>
                  </div>
                  {isAdminOfCurrentClub && (
                     <div className="form-group checkbox-group">
                        <label htmlFor="newThreadIsAnnouncement">
                            <input
                            type="checkbox"
                            id="newThreadIsAnnouncement"
                            checked={newThreadIsAnnouncement}
                            onChange={(e) => setNewThreadIsAnnouncement(e.target.checked)}
                            disabled={isSubmittingThread}
                            />
                            Marcar como Anuncio
                        </label>
                     </div>
                  )}
                  <div className="form-actions"> {/* Assuming global .form-actions */}
                    <button type="submit" disabled={isSubmittingThread} className="button button-primary">
                      {isSubmittingThread ? "Creando..." : "Crear Hilo"}
                    </button>
                    <button type="button" onClick={() => {setShowNewThreadForm(false); setThreadCreationError('');}} disabled={isSubmittingThread} className="button button-secondary">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
          {!club.libro_actual && isMember && <p className="info-message">Asigna un libro actual al club para iniciar nuevas discusiones.</p>}

          {loadingDiscussions && <p className="loading-message">Cargando discusiones...</p>}
          {discussionsError && <p className="error-message inline-error">{discussionsError}</p>}
          
          {!loadingDiscussions && !discussionsError && sortedBookGroups.length === 0 && (
            <p className="info-message">Este club aún no tiene hilos de discusión.</p>
          )}

          {!loadingDiscussions && !discussionsError && sortedBookGroups.length > 0 && (
            sortedBookGroups.map(bookGroup => (
              <div key={bookGroup.libro_id || 'general-group'} className="book-discussion-group">
                <h4>
                  Discusiones sobre: {bookGroup.libro_id ? 
                    <Link to={`/books/${bookGroup.libro_id}`}>{bookGroup.libro_titulo}</Link> 
                    : bookGroup.libro_titulo
                  }
                  {bookGroup.es_libro_actual && <span className="current-book-indicator">(Libro Actual)</span>}
                </h4>
                {bookGroup.hilos.length === 0 ? (
                    <p><small>No hay hilos para este libro todavía.</small></p>
                ) : (
                    <ul className="discussion-list">
                    {bookGroup.hilos.map(thread => (
                        <li key={thread.hilo_id} className={`discussion-thread-card ${thread.es_anuncio ? 'announcement-thread' : ''}`}>
                            <h5 className="discussion-thread-card__title">
                                <Link to={`/clubs/${clubId}/discussions/${thread.hilo_id}`}>
                                    {thread.titulo_hilo}
                                </Link>
                                {thread.es_anuncio && <span className="announcement-badge-list">[ANUNCIO]</span>}
                            </h5>
                            <p className="discussion-thread-card__content-preview">
                                {thread.contenido_inicial_hilo ? 
                                `${thread.contenido_inicial_hilo.substring(0, 100)}${thread.contenido_inicial_hilo.length > 100 ? '...' : ''}`
                                : <em>Sin contenido inicial.</em>
                                }
                            </p>
                            <small className="discussion-thread-card__meta">
                                Creado por {thread.creador_username || 'Desconocido'} el {new Date(thread.fecha_creacion_hilo).toLocaleString()}
                            </small>
                        </li>
                    ))}
                    </ul>
                )}
              </div>
            ))
          )}
        </section>
      )}
      {!isMember && club && (
        <p className="info-message">
           <Link to={currentUser ? '#' : `/login?redirect=/clubs/${clubId}`} onClick={currentUser ? handleJoinClub : undefined}>
            {currentUser ? 'Únete al club' : 'Inicia sesión y únete'}
          </Link> para ver y participar en las discusiones.
        </p>
      )}
      
      <section className="members-section panel-section">
        <h3>Miembros ({club && club.miembros ? club.miembros.length : 0})</h3>
         {club && club.miembros && club.miembros.length > 0 ? (
           <ul className="members-list">
             {club.miembros.map(member => (
               <li key={member.user_id || member.username} className="member-item">
                 {member.username} {member.rol_en_club === 'Admin' && <strong>(Admin)</strong>}
               </li>
             ))}
           </ul>
         ) : <p className="info-message">Aún no hay miembros en este club.</p>}
      </section>
      
      <Link to="/clubs" className="back-to-clubs-link button button-outline">Volver a la lista de clubes</Link>
    </div>
  );
}

export default ClubDetailPage;