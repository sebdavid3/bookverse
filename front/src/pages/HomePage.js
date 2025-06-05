// src/pages/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css'; // Importa los estilos específicos para esta página
import bookverseLogo from './logo.jpg'; // <--- 1. IMPORTA TU LOGO

function HomePage() {
  const { currentUser } = useAuth();

  const featureCardsData = [
    {
      iconEmoji: "📚",
      title: "Descubre y Organiza",
      description: "Encuentra tu próxima lectura y mantén un registro de tu progreso, calificaciones y notas personales.",
      link: "/books",
      linkText: "Explorar Libros"
    },
    {
      iconEmoji: "🧑‍🤝‍🧑",
      title: "Únete a la Comunidad",
      description: "Conecta con otros lectores en nuestros clubes de lectura virtuales. Comparte tus ideas y pasiones.",
      link: "/clubs",
      linkText: "Ver Clubes"
    },
    {
      iconEmoji: "💬",
      title: "Participa en Discusiones",
      description: "Sumérgete en conversaciones profundas sobre los libros que amas. Crea hilos y comenta.",
      link: currentUser ? "/clubs" : "/login",
      linkText: "Iniciar Discusión"
    }
  ];

  return (
    <div className="page-container"> {/* Contenedor general de la página */}
      <section className="hero-section">
        {/* --- 2. AGREGA LA IMAGEN DEL LOGO AQUÍ --- */}
        <img src={bookverseLogo} alt="BookVerse Logo" className="home-page-logo" />

        <h1 className="hero-title">Bienvenido a BookVerse</h1>
        <p className="hero-subtitle">
          Tu universo personal para explorar libros, conectar con lectores y sumergirte en grandes historias.
        </p>
        {currentUser ? (
          <p className="current-user-greeting">¡Hola de nuevo, {currentUser.username}!</p>
        ) : (
          <div className="hero-actions">
            <Link to="/register" className="button button-accent">Regístrate Gratis</Link>
            <Link to="/login" className="button button-outline">Iniciar Sesión</Link>
          </div>
        )}
      </section>

      <section className="features-section">
        <h2 className="section-title">¿Qué puedes hacer en BookVerse?</h2>
        <div className="features-grid">
          {featureCardsData.map((card, index) => (
            <div key={index} className="feature-card">
              <span className="feature-icon-emoji" role="img" aria-label="icon">{card.iconEmoji}</span>
              <h3 className="feature-title">{card.title}</h3>
              <p className="feature-description">{card.description}</p>
              <Link to={card.link} className="button button-primary feature-link">{card.linkText}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2 className="cta-title">¿Listo para Empezar tu Aventura Literaria?</h2>
        <p className="cta-subtitle">Únete a nuestra creciente comunidad de amantes de los libros hoy mismo.</p>
        {!currentUser ? (
             <Link to="/register" className="button button-accent">Crear Cuenta</Link>
        ) : (
             <Link to="/my-shelf" className="button button-primary">Ir a Mi Estantería</Link>
        )}
      </section>
    </div>
  );
}
export default HomePage;