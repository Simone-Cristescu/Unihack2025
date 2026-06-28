// src/pages/UserEventsPage.jsx
import React from 'react';
import MainScreen from '../components/MainScreen';

// Pagina pentru utilizatorii simpli care afiseaza lista de evenimente + harta
function UserEventsPage({ theme, onToggleTheme, onLogout, authToken, currentUser }) {
  // Simpler: keep the back button fixed to the bottom-left of the viewport
  // so it never moves while scrolling.

  return (
    <>
      {/* Buton plutitor de "inapoi la login" (fix in coltul stanga-jos) */}
      <button
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          padding: '8px 12px',
          borderRadius: 999,
          border: '1px solid rgba(148,163,184,0.6)',
          background: '#0f172a',
          color: '#e5e7eb',
          cursor: 'pointer',
          zIndex: 1100,
          boxShadow: '0 6px 18px rgba(2,6,23,0.6)'
        }}
        onClick={onLogout}
      >
        ← Inapoi la login
      </button>

      <MainScreen
        theme={theme}
        onToggleTheme={onToggleTheme}
        authToken={authToken}
        currentUser={currentUser}
      />
    </>
  );
}

export default UserEventsPage;

