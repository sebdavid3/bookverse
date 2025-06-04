// src/components/LoginForm.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom'; // Añadir Link
import './LoginForm.css'; // <--- IMPORTA EL CSS

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // const [message, setMessage] = useState(''); // Se redirige, así que el mensaje aquí es menos útil

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    // setMessage('');
    setIsLoading(true);
    try {
      await login(username, password);
      // setMessage("¡Login exitoso! Redirigiendo..."); // Mensaje temporal antes de redirigir
      navigate(from, { replace: true });
    } catch (err) {
      // ... (manejo de error como antes) ...
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else if (err.request) {
        setError('No se pudo conectar al servidor.');
      } else {
        setError('Error al iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container login-form-specific-styles"> {/* Aplica clases */}
      <h2>Iniciar Sesión</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="form-error-message">{error}</p>}
        {/* {message && <p className="form-success-message welcome-message">{message}</p>} */}
        
        <div className="form-group">
          <label htmlFor="login-username">Nombre de Usuario</label>
          <input
            type="text"
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Tu nombre de usuario"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="login-password">Contraseña</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Tu contraseña"
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" disabled={isLoading} className="button button-primary">
            {isLoading ? 'Iniciando...' : 'Entrar'}
          </button>
        </div>
        {/* <Link to="/forgot-password" className="forgot-password-link">¿Olvidaste tu contraseña?</Link> */}
      </form>
      <p style={{textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem'}}>
        ¿No tienes una cuenta? <Link to="/register" style={{fontWeight: '600', color: '#1D4ED8'}}>Regístrate aquí</Link>
      </p>
    </div>
  );
}

export default LoginForm;