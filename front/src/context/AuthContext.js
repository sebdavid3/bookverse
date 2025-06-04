// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios'; // O tu apiClient si lo creaste

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Para saber si estamos verificando la sesión inicial

  // Verificar si hay una sesión activa al cargar la app
  useEffect(() => {
    const checkLoggedInStatus = async () => {
      setIsLoading(true);
      try {
        // Asumimos que tienes un endpoint /api/status que devuelve el usuario si está logueado
        const response = await axios.get('/api/status', { withCredentials: true });
        if (response.data && response.data.logged_in) {
          setCurrentUser(response.data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.warn("No hay sesión activa o error al verificar estado:", error);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoggedInStatus();
  }, []);

  const login = async (username, password) => {
    // La lógica de login puede vivir aquí o llamarse desde aquí
    // Por simplicidad, retornaremos la promesa para manejarla en el componente
    // Esto es similar a lo que tenías en LoginForm, pero ahora centralizado
    const response = await axios.post('/api/login', { username, password }, { withCredentials: true });
    if (response.data && response.data.user) {
      setCurrentUser(response.data.user);
    }
    return response; // Devolvemos la respuesta para que el componente pueda actuar
  };

  const register = async (username, email, password) => {
    // Similar al login, la lógica de registro
    const response = await axios.post('/api/register', { username, email, password }, { withCredentials: true });
    // No actualizamos currentUser aquí, el usuario debe loguearse después
    return response;
  };

  const logout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      setCurrentUser(null);
    } catch (error) {
      console.error("Error durante el logout en AuthContext:", error);
      // Podrías decidir si desloguear al usuario en el frontend incluso si el backend falla
      setCurrentUser(null); 
    }
  };

  const value = {
    currentUser,
    setCurrentUser, // Podrías necesitarlo para casos especiales
    login,
    register,
    logout,
    isLoadingAuth: isLoading // Renombrado para claridad
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook personalizado para usar el AuthContext
export const useAuth = () => {
  return useContext(AuthContext);
};