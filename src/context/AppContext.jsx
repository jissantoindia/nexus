import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getUser } from '../appwrite/database';

const AppContext = createContext(null);

const initialState = {
  user: null,
  authLoading: true,
  activeProjectId: null,
  activeRequestId: null,
  response: null,
  aiProvider: localStorage.getItem('nexus_ai_provider') || 'openai',
  theme: localStorage.getItem('nexus_theme') || 'dark',                    // dark by default
  showTooltips: localStorage.getItem('nexus_tooltips') !== 'false',         // tooltips on by default
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':         return { ...state, user: action.payload, authLoading: false };
    case 'AUTH_DONE':        return { ...state, authLoading: false };
    case 'SET_ACTIVE_PROJECT': return { ...state, activeProjectId: action.payload, activeRequestId: null, response: null };
    case 'SET_ACTIVE_REQUEST': return { ...state, activeRequestId: action.payload, response: null };
    case 'SET_RESPONSE':     return { ...state, response: action.payload };
    case 'SET_AI_PROVIDER':  {
      localStorage.setItem('nexus_ai_provider', action.payload);
      return { ...state, aiProvider: action.payload };
    }
    case 'SET_THEME': {
      localStorage.setItem('nexus_theme', action.payload);
      document.documentElement.setAttribute('data-theme', action.payload);
      return { ...state, theme: action.payload };
    }
    case 'SET_TOOLTIPS': {
      localStorage.setItem('nexus_tooltips', String(action.payload));
      return { ...state, showTooltips: action.payload };
    }
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    getUser().then(user => dispatch({ type: 'SET_USER', payload: user }));
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() { return useContext(AppContext); }
