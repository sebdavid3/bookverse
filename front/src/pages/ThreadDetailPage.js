// src/pages/ThreadDetailPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios'; // O tu apiClient
import { useAuth } from '../context/AuthContext';
import './ThreadDetailPage.css'; // Import the CSS styles

function ThreadDetailPage() {
  const { clubId, threadId } = useParams();
  const { currentUser } = useAuth();
  // const navigate = useNavigate(); // Not used in current logic, but can be useful

  const [thread, setThread] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingThread, setLoadingThread] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState(null);

  const [newCommentContent, setNewCommentContent] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  const [replyToUsername, setReplyToUsername] = useState(''); // Store username for reply info
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const fetchThreadDetails = useCallback(async () => {
    setLoadingThread(true);
    setError(null);
    try {
      const response = await axios.get(`/api/discussions/${threadId}`); // Assuming direct endpoint for thread details
      setThread(response.data.thread); // Assuming API returns { thread: {...}, club_nombre: "..." } or similar
                                      // If not, adjust based on your actual API response for a single thread
    } catch (err) {
      // Try fetching from club discussions if direct endpoint fails or isn't primary
      try {
          console.warn("Direct thread fetch failed or not primary, trying from club discussions list:", err.message);
          const clubDiscussionsResponse = await axios.get(`/api/clubs/${clubId}/discussions`);
          const currentThread = clubDiscussionsResponse.data.find(t => t.hilo_id === parseInt(threadId));
          if (currentThread) {
            setThread(currentThread);
          } else {
            throw new Error("Hilo no encontrado.");
          }
      } catch (clubFetchErr) {
        setError(clubFetchErr.message || "Error al cargar el hilo.");
        console.error("Error fetching thread details:", clubFetchErr);
      }
    } finally {
      setLoadingThread(false);
    }
  }, [clubId, threadId]);

  const fetchComments = useCallback(async () => {
    if (!threadId) return;
    setLoadingComments(true);
    setCommentError('');
    try {
      const response = await axios.get(`/api/discussions/${threadId}/comments`);
      // Sort comments by date, and group replies under their parents for easier rendering
      const allComments = response.data.sort((a, b) => new Date(a.fecha_envio) - new Date(b.fecha_envio));
      setComments(allComments);
    } catch (err) {
      setCommentError(err.response?.data?.error || "Error al cargar comentarios.");
      console.error("Error fetching comments:", err);
    } finally {
      setLoadingComments(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchThreadDetails();
    fetchComments();
  }, [fetchThreadDetails, fetchComments]);

  const handlePostComment = async (event) => {
    event.preventDefault();
    if (!newCommentContent.trim()) {
      setCommentError("El comentario no puede estar vacío.");
      return;
    }
    if (!currentUser) {
      setCommentError("Debes iniciar sesión para comentar.");
      return;
    }
    setIsSubmittingComment(true);
    setCommentError('');

    try {
      const response = await axios.post(
        `/api/discussions/${threadId}/comments`,
        {
          contenido_comentario: newCommentContent,
          comentario_padre_id: replyToCommentId
        },
        { withCredentials: true }
      );
      // Add the new comment and re-sort. Or better, let fetchComments handle sorting.
      // For simplicity, just add and re-fetch for now to ensure consistent ordering with replies
      // setComments(prevComments => [...prevComments, response.data.comentario].sort((a, b) => new Date(a.fecha_envio) - new Date(b.fecha_envio)));
      fetchComments(); // Re-fetch comments to get the latest set with proper hierarchy
      setNewCommentContent('');
      setReplyToCommentId(null);
      setReplyToUsername('');
    } catch (err) {
      setCommentError(err.response?.data?.error || "Error al publicar el comentario.");
      console.error("Error posting comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const buildCommentTree = (commentList) => {
    const map = {};
    const roots = [];

    commentList.forEach(comment => {
        map[comment.comentario_id] = { ...comment, children: [] };
    });

    commentList.forEach(commentData => {
        const node = map[commentData.comentario_id];
        if (commentData.comentario_padre_id && map[commentData.comentario_padre_id]) {
            map[commentData.comentario_padre_id].children.push(node);
        } else {
            roots.push(node);
        }
    });
    return roots;
  };


  const renderCommentList = (commentNodes, isNested = false) => {
    if (!commentNodes || commentNodes.length === 0) return null;

    return (
      <ul className={isNested ? "nested-comments-list" : "comment-list"}>
        {commentNodes.map(comment => (
          <li key={comment.comentario_id} className={`comment-item ${isNested ? 'nested-comment-item' : ''}`}>
            <div className="comment-content">{comment.contenido_comentario}</div>
            <div className="comment-meta">
              <span className="author-date">
                Por: <strong>{comment.autor_username}</strong> el {new Date(comment.fecha_envio).toLocaleString()}
              </span>
              {currentUser && (
                <button
                  className="reply-button"
                  onClick={() => {
                    setReplyToCommentId(comment.comentario_id);
                    setReplyToUsername(comment.autor_username);
                    document.getElementById('newCommentContent')?.focus();
                  }}
                  disabled={isSubmittingComment}
                >
                  Responder
                </button>
              )}
            </div>
            {comment.children && comment.children.length > 0 && renderCommentList(comment.children, true)}
          </li>
        ))}
      </ul>
    );
  };

  const commentTree = buildCommentTree(comments);


  if (loadingThread) return <div className="page-container"><p className="loading-message">Cargando hilo...</p></div>;
  if (error) return <div className="page-container"><p className="error-message" style={{ color: 'red' }}>{error} <Link to={`/clubs/${clubId}`} className="back-to-club-link">Volver al club</Link></p></div>;
  if (!thread) return <div className="page-container"><p className="info-message">Hilo no encontrado. <Link to={`/clubs/${clubId}`} className="back-to-club-link">Volver al club</Link></p></div>;

  return (
    <div className="page-container thread-detail-page">
      <Link to={`/clubs/${clubId}`} className="back-to-club-link">
        ← Volver a {thread.club_nombre || 'las discusiones del club'}
      </Link>

      <article className="thread-content-card">
        <h1 className="thread-title">{thread.titulo_hilo}</h1>
        <p className="thread-meta">
          Iniciado por: <strong>{thread.creador_username || 'Desconocido'}</strong> el {new Date(thread.fecha_creacion_hilo).toLocaleString()}
          {thread.es_anuncio && <span className="announcement-badge-detail">Anuncio</span>}
        </p>
        {thread.contenido_inicial_hilo && (
          <div className="thread-initial-post-content">
            {thread.contenido_inicial_hilo}
          </div>
        )}
        {!thread.contenido_inicial_hilo && (
            <p className="thread-initial-post-content"><em>Este hilo no tiene contenido inicial.</em></p>
        )}
      </article>

      <section className="comments-section">
        <h2 className="section-title">Comentarios ({comments.length})</h2>

        {loadingComments && <p className="loading-message">Cargando comentarios...</p>}

        {currentUser && (
          <form onSubmit={handlePostComment} className="new-comment-form">
            <h4>{replyToCommentId ? `Responder a ${replyToUsername}` : 'Deja un comentario'}</h4>
            {commentError && <p className="form-error-message" style={{ color: 'red' }}>{commentError}</p>}
            
            {replyToCommentId && (
                <div className="reply-info">
                    <span>Estás respondiendo a {replyToUsername}.</span>
                    <button type="button" onClick={() => { setReplyToCommentId(null); setReplyToUsername(''); }}>Cancelar respuesta</button>
                </div>
            )}
            
            <textarea
              id="newCommentContent"
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              rows="4"
              placeholder="Escribe tu comentario..."
              required
              disabled={isSubmittingComment}
              // className="form-input" (if you have global form input styles)
            />
            <button type="submit" disabled={isSubmittingComment} className="button button-primary" /* Assuming global button styles */ >
              {isSubmittingComment ? 'Publicando...' : 'Publicar Comentario'}
            </button>
          </form>
        )}
        {!currentUser && !loadingComments && (
            <p className="info-message">
                <Link to={`/login?redirect=/clubs/${clubId}/discussions/${threadId}`}>Inicia sesión</Link> para comentar.
            </p>
        )}

        {renderCommentList(commentTree)}
        {!loadingComments && comments.length === 0 && <p className="info-message">No hay comentarios todavía.</p>}
      </section>
    </div>
  );
}

export default ThreadDetailPage;