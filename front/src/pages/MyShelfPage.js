// src/pages/MyShelfPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios'; // O tu apiClient
import './MyShelfPage.css'; // Import the CSS styles

// ---------- ShelfItemNotes Component (as provided, assuming styles are handled within or globally) ----------
function ShelfItemNotes({ estanteriaId, initialNotes = [], onNoteAction }) {
  const [notes, setNotes] = useState(initialNotes);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    setIsSubmittingNote(true);
    try {
      const response = await axios.post(`/api/shelves/${estanteriaId}/notes`, 
        { contenido_nota: newNoteContent }, 
        { withCredentials: true }
      );
      const addedNote = response.data.nota;
      setNotes(prevNotes => [addedNote, ...prevNotes].sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion)));
      setNewNoteContent('');
      if (onNoteAction) onNoteAction('added', estanteriaId, addedNote);
    } catch (error) {
      console.error("Error adding note:", error);
      alert(error.response?.data?.error || "Error al añadir la nota.");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();
    if (!editingNote || !editingNote.contenido_nota.trim()) return;
    setIsSubmittingNote(true);
    try {
      const response = await axios.put(`/api/notes/${editingNote.nota_id}`, 
        { contenido_nota: editingNote.contenido_nota }, 
        { withCredentials: true }
      );
      const updatedNoteFromAPI = response.data.nota;
      setNotes(prevNotes => 
        prevNotes.map(n => n.nota_id === updatedNoteFromAPI.nota_id ? updatedNoteFromAPI : n)
                 .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      );
      setEditingNote(null);
      if (onNoteAction) onNoteAction('updated', estanteriaId, updatedNoteFromAPI);
    } catch (error) {
      console.error("Error updating note:", error);
      alert(error.response?.data?.error || "Error al actualizar la nota.");
    } finally {
      setIsSubmittingNote(false);
    }
  };
  
  const handleDeleteNote = async (notaId) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta nota?")) {
      try {
        await axios.delete(`/api/notes/${notaId}`, { withCredentials: true });
        setNotes(prevNotes => prevNotes.filter(n => n.nota_id !== notaId));
        if (onNoteAction) onNoteAction('deleted', estanteriaId, notaId); 
      } catch (error) {
        console.error("Error deleting note:", error);
        alert(error.response?.data?.error || "Error al eliminar la nota.");
      }
    }
  };

  // Applying styles from MyShelfPage.css to the inner part of ShelfItemNotes
  return (
    <div className="shelf-item-notes"> {/* Main class for this component */}
      <h5>Notas Privadas:</h5>
      {editingNote && (
        <form onSubmit={handleUpdateNote} className="note-edit-form"> {/* Added class for specific form styling if needed */}
          <textarea
            value={editingNote.contenido_nota}
            onChange={(e) => setEditingNote({...editingNote, contenido_nota: e.target.value})}
            rows="3"
            placeholder="Edita tu nota..."
            required
            disabled={isSubmittingNote}
            className="form-input" // Assuming global or MyShelfPage.css defined .form-input
          ></textarea>
          <div className="form-actions"> {/* Assuming global or MyShelfPage.css defined .form-actions */}
            <button type="submit" disabled={isSubmittingNote} className="button button-primary">
                {isSubmittingNote ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button type="button" onClick={() => setEditingNote(null)} disabled={isSubmittingNote} className="button button-secondary">
                Cancelar
            </button>
          </div>
        </form>
      )}

      {!editingNote && (
        <form onSubmit={handleAddNote} className="note-add-form"> {/* Added class */}
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows="3"
            placeholder="Escribe una nueva nota..."
            required
            disabled={isSubmittingNote}
            className="form-input"
          ></textarea>
          <div className="form-actions">
            <button type="submit" disabled={isSubmittingNote} className="button button-primary">
                {isSubmittingNote ? 'Añadiendo...' : 'Añadir Nota'}
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 && <p className="info-message small">No hay notas para este libro.</p>}
      <ul className="notes-list"> {/* Added class */}
        {notes.map(note => (
          <li key={note.nota_id} className="note-entry"> {/* Added class */}
            <p>{note.contenido_nota}</p>
            <small>
              {new Date(note.fecha_creacion).toLocaleDateString()}
              {note.fecha_modificacion && new Date(note.fecha_modificacion).getTime() !== new Date(note.fecha_creacion).getTime() && 
                ` (Mod: ${new Date(note.fecha_modificacion).toLocaleDateString()})`}
            </small>
            {!editingNote && (
                <div className="note-actions"> {/* Added class */}
                    <button onClick={() => setEditingNote({ nota_id: note.nota_id, contenido_nota: note.contenido_nota })} className="button button-link edit">Editar</button>
                    <button onClick={() => handleDeleteNote(note.nota_id)} className="button button-link delete">Eliminar</button>
                </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
// ---------- Fin de ShelfItemNotes Component ----------

// ---------- StarRatingInput Component (styles applied inline for simplicity, can be moved to CSS) ----------
function StarRatingInput({ rating, onRatingChange, maxStars = 5 }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="star-rating-input">
      {[...Array(maxStars)].map((_, index) => {
        const starValue = index + 1;
        return (
          <span
            key={starValue}
            className={`star ${starValue <= (hoverRating || rating || 0) ? 'filled' : ''}`}
            onClick={() => onRatingChange(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
            title={`${starValue} estrella${starValue > 1 ? 's' : ''}`}
          >
            ★ 
          </span>
        );
      })}
      {(rating > 0) && (
        <button
          onClick={() => onRatingChange(null)}
          className="clear-rating-button"
          title="Limpiar calificación"
        >
          ✕
        </button>
      )}
    </div>
  );
}
// ---------- Fin de StarRatingInput Component ----------


function MyShelfPage() {
  const { currentUser } = useAuth();
  const [shelves, setShelves] = useState([]);
  const [loadingShelves, setLoadingShelves] = useState(true);
  const [shelfError, setShelfError] = useState(null);
  const [shelfSearchTerm, setShelfSearchTerm] = useState('');

  const [newBookSearchTerm, setNewBookSearchTerm] = useState('');
  const [newBookSearchResults, setNewBookSearchResults] = useState([]);
  const [loadingNewBooks, setLoadingNewBooks] = useState(false);
  const [newBookError, setNewBookError] = useState(null);
  const [addBookMessage, setAddBookMessage] = useState('');

  useEffect(() => {
    const fetchShelves = async () => {
      if (!currentUser) { setLoadingShelves(false); return; }
      setLoadingShelves(true);
      try {
        const response = await axios.get('/api/shelves', { withCredentials: true });
        const shelvesWithInitializedNotes = response.data.map(shelf => ({
            ...shelf,
            notas: (shelf.notas || []).sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
        }));
        setShelves(shelvesWithInitializedNotes);
        setShelfError(null);
      } catch (err) {
        setShelfError(err.response?.data?.error || err.message || "Error al obtener las estanterías");
        setShelves([]);
      } finally {
        setLoadingShelves(false);
      }
    };
    fetchShelves();
  }, [currentUser]);

  useEffect(() => {
    if (newBookSearchTerm.trim() === '') { setNewBookSearchResults([]); setNewBookError(null); return; }
    setLoadingNewBooks(true); setNewBookError(null); setAddBookMessage('');
    const timerId = setTimeout(async () => {
      try {
        const response = await axios.get(`/api/books?search=${newBookSearchTerm}`);
        setNewBookSearchResults(response.data);
      } catch (err) {
        setNewBookError(err.response?.data?.error || err.message || "Error al buscar libros");
        setNewBookSearchResults([]);
      } finally { setLoadingNewBooks(false); }
    }, 500);
    return () => clearTimeout(timerId);
  }, [newBookSearchTerm]);

  const handleAddNewBookToShelf = async (book, estadoLectura) => {
    if (!currentUser || !book) return;
    setAddBookMessage('');
    try {
      const response = await axios.post('/api/shelves', { libro_id: book.libro_id, estado_lectura: estadoLectura }, { withCredentials: true });
      const addedShelfItemFromResponse = response.data.shelf_item;
      
      const newShelfEntry = { 
          ...book, 
          estanteria_id: addedShelfItemFromResponse ? addedShelfItemFromResponse.estanteria_id : Date.now(), 
          estado_lectura: estadoLectura, 
          calificacion_usuario: null,
          progreso_paginas: null,
          fecha_agregado: new Date().toISOString(),
          notas: [] 
      };
      setShelves(prevShelves => [newShelfEntry, ...prevShelves].sort((a,b) => new Date(b.fecha_agregado) - new Date(a.fecha_agregado)));
      setAddBookMessage({text: `'${book.titulo}' añadido a "${estadoLectura === 'QuieroLeer' ? 'Quiero Leer' : estadoLectura}"!`, type: 'success'});
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setAddBookMessage({text: err.response.data.error || `"${book.titulo}" ya está en tu estantería.`, type: 'error'});
      } else {
        setAddBookMessage({text: err.response?.data?.error || "Error al añadir el libro.", type: 'error'});
      }
    }
  };

  const updateShelfItem = async (estanteriaId, updates) => {
    try {
        const response = await axios.put(`/api/shelves/${estanteriaId}`, updates, { withCredentials: true });
        setShelves(prevShelves => 
            prevShelves.map(shelf => 
                shelf.estanteria_id === estanteriaId ? { ...shelf, ...response.data.item } : shelf
            )
        );
    } catch (err) {
        console.error("Error updating shelf item:", err);
        alert(err.response?.data?.error || "Error al actualizar la estantería.");
    }
  };

  const deleteShelfItem = async (estanteriaId) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este libro de tu estantería?")) {
        try {
            await axios.delete(`/api/shelves/${estanteriaId}`, { withCredentials: true });
            setShelves(prevShelves => 
                prevShelves.filter(shelf => shelf.estanteria_id !== estanteriaId)
            );
        } catch (err) {
            console.error("Error deleting shelf item:", err);
            alert(err.response?.data?.error || "Error al eliminar el libro de la estantería.");
        }
    }
  };

  const handleNoteActionOnShelf = (actionType, estanteriaId, noteData) => {
    setShelves(prevShelves =>
      prevShelves.map(shelf => {
        if (shelf.estanteria_id === estanteriaId) {
          let updatedNotes;
          if (actionType === 'added') {
            updatedNotes = [noteData, ...(shelf.notas || [])];
          } else if (actionType === 'updated') {
            updatedNotes = (shelf.notas || []).map(n => n.nota_id === noteData.nota_id ? noteData : n);
          } else if (actionType === 'deleted') { 
            updatedNotes = (shelf.notas || []).filter(n => n.nota_id !== noteData);
          } else {
            updatedNotes = shelf.notas;
          }
          return { ...shelf, notas: updatedNotes.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion)) };
        }
        return shelf;
      })
    );
  };

  const filteredShelves = useMemo(() => {
    if (!shelfSearchTerm) return shelves;
    return shelves.filter(
      (shelf) =>
        (shelf.titulo && shelf.titulo.toLowerCase().includes(shelfSearchTerm.toLowerCase())) ||
        (shelf.autor && shelf.autor.toLowerCase().includes(shelfSearchTerm.toLowerCase()))
    );
  }, [shelves, shelfSearchTerm]);

  if (loadingShelves) { return <div className="page-container"><p className="loading-message">Cargando tu estantería...</p></div>; }
  if (shelfError) { return <div className="page-container"><p className="error-message page-level">Error al cargar tu estantería: {shelfError}</p></div>; }

  const groupedCurrentShelves = filteredShelves.reduce((acc, shelf) => {
    const estado = shelf.estado_lectura;
    if (!acc[estado]) acc[estado] = [];
    acc[estado].push(shelf);
    return acc;
  }, {});
  const estadosOrdenados = ['Leyendo', 'QuieroLeer', 'Leido'];

  return (
    <div className="page-container my-shelf-page"> {/* Added my-shelf-page for specificity */}
      <h2 className="page-title">Mi Estantería</h2> {/* page-title is global */}
      
      <section className="add-new-book-section panel-section"> {/* panel-section for base styling */}
        <h3>Añadir Nuevo Libro a Mi Estantería</h3>
        <input
          type="text"
          placeholder="Buscar libro por título o autor para añadir..."
          value={newBookSearchTerm}
          onChange={(e) => setNewBookSearchTerm(e.target.value)}
          className="form-input" // Assuming global .form-input style
        />
        {loadingNewBooks && <p className="loading-message">Buscando...</p>}
        {newBookError && <p className="search-error-message">Error en la búsqueda: {newBookError}</p>}
        {addBookMessage.text && 
            <p className={`add-book-feedback-message ${addBookMessage.type}`}>
                {addBookMessage.text}
            </p>
        }

        {newBookSearchResults.length > 0 && (
          <ul className="new-book-search-results">
            {newBookSearchResults.map(book => (
              <li key={`search-${book.libro_id}`} className="search-result-item">
                <div className="book-info">
                  <strong>{book.titulo}</strong>
                  <small>Por: {book.autor || 'N/A'} ({book.anio_publicacion || 'N/A'})</small>
                </div>
                <div className="add-buttons">
                  <button onClick={() => handleAddNewBookToShelf(book, 'QuieroLeer')} title="Añadir a Quiero Leer" className="button">Quiero Leer</button>
                  <button onClick={() => handleAddNewBookToShelf(book, 'Leyendo')} title="Añadir a Leyendo" className="button">Leyendo</button>
                  <button onClick={() => handleAddNewBookToShelf(book, 'Leido')} title="Añadir a Leído" className="button">Leído</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {newBookSearchTerm.trim() !== '' && !loadingNewBooks && newBookSearchResults.length === 0 && !newBookError && (
          <p className="info-message">No se encontraron libros para "{newBookSearchTerm}".</p>
        )}
      </section>

      <section className="my-current-shelf-section">
        {/* The h2 "Mi Estantería Actual" was removed as the .page-title serves this purpose, but you can re-add if needed */}
        <input
          type="text"
          placeholder="Filtrar en mi estantería actual..."
          value={shelfSearchTerm}
          onChange={(e) => setShelfSearchTerm(e.target.value)}
          className="shelf-filter-input form-input" // form-input for base style
        />
      </section>

      {shelves.length === 0 && !loadingShelves && <p className="info-message">Aún no tienes libros en tu estantería.</p>}
      {shelves.length > 0 && filteredShelves.length === 0 && shelfSearchTerm && (
        <p className="info-message">No se encontraron libros en tu estantería que coincidan con "{shelfSearchTerm}".</p>
      )}
      
      {estadosOrdenados.map(estado => (
        groupedCurrentShelves[estado] && groupedCurrentShelves[estado].length > 0 && (
          <section key={estado} className={`shelf-section panel-section shelf-group-${estado.toLowerCase()}`}> {/* panel-section for base, specific class for group */}
            <h3>{estado === 'QuieroLeer' ? 'Quiero Leer' : estado} ({groupedCurrentShelves[estado].length})</h3>
            <ul className="shelf-books-list">
              {groupedCurrentShelves[estado].map(item => (
                <li key={item.estanteria_id} className="shelf-item">
                  {item.url_portada && <img src={item.url_portada} alt={item.titulo} className="book-cover-shelf" />}
                  <h4 className="shelf-item-title">{item.titulo}</h4>
                  <p className="shelf-item-author">Autor: {item.autor || 'N/A'}</p>
                  
                  <div className="shelf-item-meta">
                    {item.estado_lectura !== 'QuieroLeer' && item.estado_lectura !== 'Leido' && ( 
                        <p>Progreso: {item.progreso_paginas ? `${item.progreso_paginas} páginas` : 'No iniciado'}</p> 
                    )}
                    {/* StarRatingInput handles display for rating */}
                  </div>

                  <div className="shelf-item-controls">
                    <select 
                        value={item.estado_lectura} 
                        onChange={(e) => updateShelfItem(item.estanteria_id, { estado_lectura: e.target.value })}
                        className="form-select" // Assuming global .form-select
                    >
                        <option value="QuieroLeer">Quiero Leer</option>
                        <option value="Leyendo">Leyendo</option>
                        <option value="Leido">Leído</option>
                    </select>

                    {item.estado_lectura === 'Leyendo' && (
                        <input 
                            type="number" 
                            placeholder="Págs leídas" 
                            defaultValue={item.progreso_paginas || ''}
                            onBlur={(e) => {
                                const value = e.target.value;
                                updateShelfItem(item.estanteria_id, { progreso_paginas: value ? parseInt(value) : null })
                            }}
                            className="form-input" // Assuming global .form-input
                        />
                    )}
                     {item.estado_lectura === 'Leido' && (
                        <StarRatingInput
                            rating={item.calificacion_usuario}
                            onRatingChange={(newRating) => updateShelfItem(item.estanteria_id, { calificacion_usuario: newRating })}
                        />
                    )}
                    <button 
                        onClick={() => deleteShelfItem(item.estanteria_id)} 
                        className="delete-button button" // Added 'button' for base button styles
                        title="Eliminar de la estantería"
                    >
                        Eliminar
                    </button>
                  </div>
                  
                  <ShelfItemNotes 
                    estanteriaId={item.estanteria_id} 
                    initialNotes={item.notas || []}
                    onNoteAction={handleNoteActionOnShelf}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      ))}
    </div>
  );
}

export default MyShelfPage;