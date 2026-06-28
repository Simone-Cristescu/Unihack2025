// src/App.jsx
import React, { useState } from 'react';
import AuthScreen from './components/AuthScreen';
import OrganizerSignupPage from './pages/OrganizerSignupPage';
import UserEventsPage from './pages/UserEventsPage';
import OrganizerDashboard from './pages/OrganizerDashboard';

const API_BASE_URL = 'http://127.0.0.1:5000';

function App() {
  // null | 'user' | 'organizer' | 'organizer-signup'
  const [role, setRole] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [pendingOrganizerEmail, setPendingOrganizerEmail] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // ================== HANDLERE GENERALE ==================
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogoutToAuth = () => {
    // inapoi la ecranul de login / register
    setRole(null);
    setPendingOrganizerEmail('');
    setAuthToken(null);
    setCurrentUser(null);
  };

  // ================== LOGIN / SIGNUP ==================
  const handleUserLogin = (token, user) => {
    setAuthToken(token || null);
    setCurrentUser(user || null);
    setRole('user');
  };

  const handleOrganizerLogin = (token, user) => {
    // organizator deja existent -> direct in dashboard
    setAuthToken(token || null);
    setCurrentUser(user || null);
    setRole('organizer');
  };

  const handleOrganizerSignup = async (email, password) => {
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail || !password) {
      alert('Emailul si parola pentru organizator sunt obligatorii.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/organizers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail.toLowerCase(),
          password,
          // folosim partea dinainte de @ ca nume implicit al organizatorului
          orgName: trimmedEmail.split('@')[0] || trimmedEmail.toLowerCase(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Inregistrarea organizatorului a esuat (cod ${res.status}).`;
        alert(message);
        return;
      }

      const token = data.token || null;
      let orgInfo = null;

      if (token) {
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/organizers/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const meData = await meRes.json().catch(() => ({}));
          if (meRes.ok) {
            orgInfo = meData;
          }
        } catch (err) {
          console.warn('Nu am putut obtine profilul organizatorului dupa inregistrare.', err);
        }
      }

      alert('Cont de organizator creat cu succes!');
      setAuthToken(token || null);
      setCurrentUser(orgInfo || null);
      setRole('organizer');
    } catch (error) {
      console.error(error);
      alert('Eroare la conectarea cu serverul pentru inregistrarea organizatorului.');
    }
  };

  // ================== RENDER PE ROL ==================

  // Utilizator normal -> pagina cu evenimente
  if (role === 'user') {
    return (
      <UserEventsPage
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogoutToAuth}
        authToken={authToken}
        currentUser={currentUser}
      />
    );
  }

  // Organizator logat complet -> folosim UI-ul vechi (OrganizerSignupPage) dar cu backend
  if (role === 'organizer') {
    return (
      <OrganizerSignupPage
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogoutToAuth}
        authToken={authToken}
        currentUser={currentUser}
      />
    );
  }

  // Ecranul de autentificare (cand role === null)
  return (
    <AuthScreen
      theme={theme}
      onToggleTheme={handleToggleTheme}
      onAuthSuccess={handleUserLogin}          // user normal
      onOrganizerLogin={handleOrganizerLogin}  // login ca organizator
      onOrganizerSignup={handleOrganizerSignup} // "Devino organizator"
    />
  );
}

export default App;
