// src/components/RegisterForm.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom'; // Añadir Link
import './RegisterForm.css'; // <--- IMPORTA EL CSS

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) { // Ejemplo de validación simple
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    setIsLoading(true);

    try {
      const response = await register(username, email, password);
      setMessage(response.data.message + " Serás redirigido para iniciar sesión.");
      // Limpiar formulario
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        navigate('/login');
      }, 2500); // Redirigir después de un breve mensaje

    } catch (err) {
      // ... (manejo de error como antes) ...
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else if (err.request) {
        setError('No se pudo conectar al servidor.');
      } else {
        setError('Error durante el registro. Inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container register-form-specific-styles"> {/* Aplica clases */}
      <h2>Crear una Cuenta</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="form-error-message">{error}</p>}
        {message && <p className="form-success-message">{message}</p>}

        <div className="form-group">
          <label htmlFor="register-username">Nombre de Usuario</label>
          <input
            type="text"
            id="register-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Elige un nombre de usuario"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-email">Email</label>
          <input
            type="email"
            id="register-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            placeholder="tu@email.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-password">Contraseña</label>
          <input
            type="password"
            id="register-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            disabled={isLoading}
            placeholder="Mínimo 6 caracteres"
          />
          {/* <p className="password-requirements">Mínimo 6 caracteres.</p> */}
        </div>

        <div className="form-group">
          <label htmlFor="register-confirm-password">Confirmar Contraseña</label>
          <input
            type="password"
            id="register-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength="6"
            disabled={isLoading}
            placeholder="Repite tu contraseña"
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" disabled={isLoading} className="button button-primary">
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </div>
      </form>
      <p style={{textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem'}}>
        ¿Ya tienes una cuenta? <Link to="/login" style={{fontWeight: '600', color: '#1D4ED8'}}>Inicia sesión aquí</Link>
      </p>
    </div>
  );
}

export default RegisterForm;