// src/components/AuthScreen.jsx
import React, { useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:5000';

function AuthScreen({ onAuthSuccess, onOrganizerLogin, onOrganizerSignup, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login');
  const [accountType, setAccountType] = useState('participant'); // participant | organizer | guest
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validare email folosind API
  const validateEmail = async (email) => {
    setEmailError('');
    if (!email.trim()) return false;

    // Validare format bazic
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Formatul email-ului este invalid.');
      return false;
    }

    setIsValidatingEmail(true);
    try {
      const response = await fetch(
        `https://emailvalidation.abstractapi.com/v1/?api_key=test&email=${encodeURIComponent(
          email
        )}`
      );
      const data = await response.json();

      setIsValidatingEmail(false);

      // Verificăm dacă email-ul este valid
      if (data.deliverability === 'UNDELIVERABLE') {
        setEmailError('Acest email nu este valid sau nu există.');
        return false;
      }

      return true;
    } catch (error) {
      setIsValidatingEmail(false);
      // Dacă API-ul eșuează, permitem continuarea (fallback la validare bazică)
      console.warn('Email validation API failed, using basic validation');
      return true;
    }
  };

  // Validare parolă
  const validatePassword = (password) => {
    setPasswordError('');

    if (password.length < 10) {
      setPasswordError('Parola trebuie să aibă minim 10 caractere.');
      return false;
    }

    const letters = password.match(/[a-zA-Z]/g) || [];
    const uppercaseLetters = password.match(/[A-Z]/g) || [];
    const digits = password.match(/\d/g) || [];
    const specialChars = password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || [];

    if (letters.length < 7) {
      setPasswordError('Parola trebuie să aibă minim 7 litere.');
      return false;
    }

    if (uppercaseLetters.length < 2) {
      setPasswordError('Parola trebuie să aibă minim 2 litere mari.');
      return false;
    }

    if (digits.length < 2) {
      setPasswordError('Parola trebuie să aibă minim 2 cifre.');
      return false;
    }

    if (specialChars.length < 1) {
      setPasswordError('Parola trebuie să aibă minim 1 caracter special (!@#$%^&* etc.).');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Completați toate câmpurile.');
      return;
    }

    // Simulăm verificare dacă e cont de organizator
    const isOrganizerAccount = email.includes('organizator') || email.includes('org');

    if (isOrganizerAccount && onOrganizerLogin) {
      onOrganizerLogin();
    } else {
      onAuthSuccess();
    }
  };

  const handleRegister = async () => {
    // Dacă e Guest, nu cerem date, doar intrăm
    if (accountType === 'guest') {
      alert('Ai intrat ca invitat. Poți explora evenimentele, dar pentru rezervări va fi nevoie de cont.');
      onAuthSuccess();
      return;
    }

    if (!email.trim() || !password.trim() || !confirmPass.trim()) {
      alert('Completați toate câmpurile obligatorii.');
      return;
    }

    // Validare email
    const isEmailValid = await validateEmail(email);
    if (!isEmailValid) {
      return;
    }

    // Validare parolă
    if (!validatePassword(password)) {
      return;
    }

    if (password !== confirmPass) {
      alert('Parolele nu se potrivesc!');
      return;
    }

    if (accountType === 'organizer') {
      // Redirecționează către pagina de completare date organizator
      if (onOrganizerSignup) {
        onOrganizerSignup(email, password);
      }
    } else {
      alert('Cont creat cu succes!');
      onAuthSuccess();
    }
  };

  const handleLoginApi = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      alert('Completează toate câmpurile.');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail.toLowerCase(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Autentificare eșuată (cod ${res.status}).`;
        alert(message);
        return;
      }

      const token = data.token;
      if (!token) {
        alert('Autentificare reușită, dar lipseste token-ul din răspuns.');
        if (onAuthSuccess) {
          onAuthSuccess(null, null);
        }
        return;
      }

      let userRole = 'user';
      let userInfo = null;

      try {
        const meRes = await fetch(`${API_BASE_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json().catch(() => ({}));
        if (meRes.ok) {
          userRole = meData.role || 'user';
          userInfo = meData;
        }
      } catch (err) {
        console.warn('Nu am putut obE>ine datele utilizatorului (/api/me).', err);
      }

      if (userRole === 'organizer' && onOrganizerLogin) {
        onOrganizerLogin(token, userInfo);
      } else if (onAuthSuccess) {
        onAuthSuccess(token, userInfo);
      }
    } catch (error) {
      console.error(error);
      alert('Eroare la conectarea cu serverul. Verifică dacă backend-ul rulează pe 127.0.0.1:5000.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterApi = async () => {
    // Dac�� e Guest, nu cerem date, doar intr��m
    if (accountType === 'guest') {
      alert('Ai intrat ca invitat. Poți explora evenimentele, dar pentru rezervări va fi nevoie de cont.');
      if (onAuthSuccess) {
        onAuthSuccess(null, null);
      }
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim() || !confirmPass.trim()) {
      alert('CompletaE>i toate cA�mpurile obligatorii.');
      return;
    }

    // Validare email
    const isEmailValid = await validateEmail(trimmedEmail);
    if (!isEmailValid) {
      return;
    }

    // Validare parol��
    if (!validatePassword(password)) {
      return;
    }

    if (password !== confirmPass) {
      alert('Parolele nu se potrivesc!');
      return;
    }

    if (accountType === 'organizer') {
      // RedirecE>ioneaz�� c��tre pagina de completare date organizator
      if (onOrganizerSignup) {
        onOrganizerSignup(trimmedEmail, password);
      }
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail.toLowerCase(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `AZnregistrare eETuat�� (cod ${res.status}).`;
        alert(message);
        return;
      }

      const token = data.token || null;
      let userInfo = null;

      if (token) {
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const meData = await meRes.json().catch(() => ({}));
          if (meRes.ok) {
            userInfo = meData;
          }
        } catch (err) {
          console.warn('Nu am putut obE>ine profilul utilizatorului dup�� AZnregistrare.', err);
        }
      }

      alert('Cont creat cu succes!');
      if (onAuthSuccess) {
        onAuthSuccess(token, userInfo);
      }
    } catch (error) {
      console.error(error);
      alert('Eroare la conectarea cu serverul. Verific�� dac�� backend-ul ruleaz�� pe 127.0.0.1:5000.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubmitLabel = () => {
    if (mode === 'login') return 'Continuă';
    if (accountType === 'guest') return 'Intră ca invitat';
    return 'Creează cont';
  };

  return (
    <div className={`auth-page ${theme}`}>
      <div className="auth-container">
        <button className="global-theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>

        <div className="auth-left">
          <div className="auth-branding">
            <h1 className="brand-title">
              BegaVibe
              <span className="brand-accent"></span>
            </h1>
            <p className="brand-subtitle">
              Toate vibrațiile Timișoarei într-un singur loc.
            </p>
            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="feature-text">
                  <strong>Evenimente live</strong>
                  <span>Actualizate zilnic</span>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M12 6V12L16 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="feature-text">
                  <strong>Bilete instant</strong>
                  <span>Rezervare rapidă</span>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div className="feature-text">
                  <strong>Hartă interactivă</strong>
                  <span>Orientare ușoară</span>
                </div>
              </div>
            </div>
          </div>

          <div className="timisoara-skyline">
            <svg viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0 120V80H20V60H40V80H60V70H80V90H100V75H120V95H140V85H160V100H180V90H200V85H220V95H240V80H260V90H280V75H300V85H320V70H340V80H360V65H380V80H400V120H0Z"
                fill="url(#skyline-gradient)"
                opacity="0.15"
              />
              <path
                d="M50 60L55 50L60 60M170 85L175 75L180 85M310 70L315 60L320 70"
                stroke="url(#light-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="55" cy="50" r="2" fill="#fbbf24" />
              <circle cx="175" cy="75" r="2" fill="#fbbf24" />
              <circle cx="315" cy="60" r="2" fill="#fbbf24" />
              <defs>
                <linearGradient id="skyline-gradient" x1="0" y1="0" x2="400" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <linearGradient id="light-gradient" x1="0" y1="0" x2="400" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
            <div className="river-flow"></div>
          </div>
        </div>

        <div className="auth-right">
          <div className="glass-card auth-form">
            <h2 className="form-title">
              {mode === 'login' ? 'Bine ai revenit!' : 'Creează-ți contul'}
            </h2>
            <p className="form-subtitle">
              {mode === 'login'
                ? 'Intră în vibe-ul orașului cu un singur cont.'
                : 'Află primul despre concerte, festivaluri și experiențe noi.'}
            </p>

            {mode === 'register' && (
              <div className="organizer-toggle">
                <button
                  type="button"
                  className={`toggle-option ${accountType === 'participant' ? 'active' : ''}`}
                  onClick={() => setAccountType('participant')}
                >
                  Participant
                </button>
                <button
                  type="button"
                  className={`toggle-option ${accountType === 'organizer' ? 'active' : ''}`}
                  onClick={() => setAccountType('organizer')}
                >
                  Organizator
                </button>
                <button
                  type="button"
                  className={`toggle-option ${accountType === 'guest' ? 'active' : ''}`}
                  onClick={() => {
                    setAccountType('guest');
                    setEmail('');
                    setPassword('');
                    setConfirmPass('');
                    setEmailError('');
                    setPasswordError('');
                  }}
                >
                  Guest
                </button>
              </div>
            )}

            <div className="form-scroll-container">
              {!(mode === 'register' && accountType === 'guest') && (
                <>
                  <div className="input-group">
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      className={`input-field ${emailError ? 'input-error' : ''}`}
                      placeholder="nume@exemplu.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError('');
                      }}
                    />
                    {emailError && <p className="error-message">{emailError}</p>}
                    {isValidatingEmail && <p className="info-message">Se verifică email-ul...</p>}
                  </div>

                  <div className="input-group">
                    <label className="input-label">Parolă</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`input-field ${passwordError ? 'input-error' : ''}`}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError('');
                        }}
                      />
                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M3 3L21 21M10.5 10.677A2 2 0 0013.323 13.5M12 5.5C7 5.5 3 12 3 12C3 12 4.5 14.5 7 16.5M9.878 9.878C9.316 10.44 9 11.175 9 12C9 13.657 10.343 15 12 15C12.825 15 13.56 14.684 14.122 14.122M15 8.5C14.09 7.94 13.08 7.5 12 7.5M17 13C18.5 11.5 21 12 21 12C21 12 17 18.5 12 18.5C11.35 18.5 10.73 18.41 10.14 18.25"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M12 5.5C7 5.5 3 12 3 12C3 12 7 18.5 12 18.5C17 18.5 21 12 21 12C21 12 17 5.5 12 5.5Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {passwordError && <p className="error-message">{passwordError}</p>}
                    {mode === 'register' && !passwordError && (
                      <p className="password-requirements">
                        Minim 10 caractere: 7 litere (2 mari), 2 cifre, 1 caracter special
                      </p>
                    )}
                  </div>

                  {mode === 'register' && (
                    <div className="input-group">
                      <label className="input-label">Confirmă parola</label>
                      <div className="password-input-wrapper">
                        <input
                          type={showConfirmPass ? 'text' : 'password'}
                          className="input-field"
                          placeholder="••••••••"
                          value={confirmPass}
                          onChange={(e) => setConfirmPass(e.target.value)}
                        />
                        <button
                          type="button"
                          className="toggle-password"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          aria-label={showConfirmPass ? 'Ascunde parola' : 'Arată parola'}
                        >
                          {showConfirmPass ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M3 3L21 21M10.5 10.677A2 2 0 0013.323 13.5M12 5.5C7 5.5 3 12 3 12C3 12 4.5 14.5 7 16.5M9.878 9.878C9.316 10.44 9 11.175 9 12C9 13.657 10.343 15 12 15C12.825 15 13.56 14.684 14.122 14.122M15 8.5C14.09 7.94 13.08 7.5 12 7.5M17 13C18.5 11.5 21 12 21 12C21 12 17 18.5 12 18.5C11.35 18.5 10.73 18.41 10.14 18.25"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 5.5C7 5.5 3 12 3 12C3 12 7 18.5 12 18.5C17 18.5 21 12 21 12C21 12 17 5.5 12 5.5Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {mode === 'register' && accountType === 'guest' && (
                <div className="input-group">
                  <p className="info-message">
                    Nu ai nevoie de email sau parolă pentru a intra ca invitat. Doar apasă{' '}
                    <strong>„Intră ca invitat"</strong> și poți explora evenimentele.
                  </p>
                </div>
              )}
            </div>

            <button
              className="submit-button"
              onClick={mode === 'login' ? handleLoginApi : handleRegisterApi}
              disabled={(isValidatingEmail && accountType !== 'guest') || isSubmitting}
            >
              {getSubmitLabel()}
            </button>

            <div className="form-switch">
              {mode === 'login' ? (
                <p>
                  Nu ai cont?{' '}
                  <button onClick={() => setMode('register')} className="switch-link">
                    Înregistrează-te
                  </button>
                </p>
              ) : (
                <p>
                  Ai deja cont?{' '}
                  <button onClick={() => setMode('login')} className="switch-link">
                    Autentifică-te
                  </button>
                </p>
              )}
            </div>

            {mode === 'login' && (
              <div className="login-hint">
                <p>
                  💡 Sfat: Organizatorii pot folosi email-uri care conțin{' '}
                  <span className="hint-highlight">"organizator"</span> sau{' '}
                  <span className="hint-highlight">"org"</span>. <br />
                  Sau poți intra din ecranul de înregistrare ca{' '}
                  <span className="hint-highlight">Guest</span> doar ca să vezi despre ce e vorba.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #020617;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .auth-page {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(ellipse at top, rgba(99, 102, 241, 0.15) 0%, #020617 50%, #020617 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
        }

        .auth-page.light {
          background: radial-gradient(ellipse at top, #e0f2fe 0%, #f3f4f6 50%, #f9fafb 100%);
        }

        .auth-page::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.4), transparent 70%);
          filter: blur(100px);
          animation: pulse 8s ease-in-out infinite;
        }

        .auth-page::after {
          content: '';
          position: absolute;
          bottom: -30%;
          right: -10%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.3), transparent 70%);
          filter: blur(100px);
          animation: pulse 10s ease-in-out infinite reverse;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }

        .auth-container {
          width: 100%;
          max-width: 1200px;
          background: rgba(15, 23, 42, 0.7);
          border-radius: 32px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          backdrop-filter: blur(40px);
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
          min-height: 600px;
          position: relative;
          z-index: 1;
          box-shadow:
            0 40px 100px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          overflow: hidden;
        }

        .auth-page.light .auth-container {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(226, 232, 240, 0.8);
          box-shadow:
            0 24px 60px rgba(15, 23, 42, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 1);
        }

        .global-theme-toggle {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 5;
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .global-theme-toggle:hover {
          background: rgba(15, 23, 42, 0.7);
          border-color: rgba(148, 163, 184, 0.5);
        }

        .auth-page.light .global-theme-toggle {
          background: rgba(255, 255, 255, 0.8);
          color: #111827;
          border-color: #e5e7eb;
        }

        .auth-left {
          padding: 60px 50px;
          position: relative;
          border-right: 1px solid rgba(148, 163, 184, 0.15);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }

        .auth-left::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, transparent 50%);
          pointer-events: none;
        }

        .auth-branding {
          position: relative;
          z-index: 2;
        }

        .brand-title {
          font-size: 48px;
          font-weight: 900;
          color: #f9fafb;
          margin-bottom: 12px;
          letter-spacing: -2px;
          display: flex;
          align-items: center;
          gap: 12px;
          line-height: 1;
        }

        .auth-page.light .brand-title {
          color: #111827;
        }

        .brand-accent {
          width: 6px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(180deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
          50% { opacity: 0.7; box-shadow: 0 0 30px rgba(168, 85, 247, 0.7); }
        }

        .brand-subtitle {
          font-size: 16px;
          color: #94a3b8;
          line-height: 1.6;
          max-width: 400px;
          margin-bottom: 40px;
        }

        .auth-page.light .brand-subtitle {
          color: #64748b;
        }

        .brand-features {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(148, 163, 184, 0.1);
          transition: all 0.3s ease;
        }

        .feature-item:hover {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(148, 163, 184, 0.2);
          transform: translateX(5px);
        }

        .auth-page.light .feature-item {
          background: rgba(255, 255, 255, 0.6);
          border-color: #e5e7eb;
        }

        .auth-page.light .feature-item:hover {
          background: rgba(255, 255, 255, 0.9);
        }

        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          flex-shrink: 0;
        }

        .feature-icon svg {
          width: 20px;
          height: 20px;
        }

        .feature-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .feature-text strong {
          font-size: 14px;
          font-weight: 600;
          color: #f9fafb;
        }

        .auth-page.light .feature-text strong {
          color: #111827;
        }

        .feature-text span {
          font-size: 12px;
          color: #94a3b8;
        }

        .auth-page.light .feature-text span {
          color: #64748b;
        }

        .timisoara-skyline {
          position: relative;
          margin-top: 40px;
        }

        .timisoara-skyline svg {
          width: 100%;
          height: auto;
          opacity: 0.6;
        }

        .river-flow {
          height: 3px;
          background: linear-gradient(90deg, transparent, #3b82f6, #6366f1, transparent);
          margin-top: 8px;
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }

        .river-flow::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
          animation: flow 3s linear infinite;
        }

        @keyframes flow {
          to { left: 100%; }
        }

        .auth-right {
          padding: 50px 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .glass-card {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 24px;
          padding: 32px 28px;
          width: 100%;
          max-width: 450px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          box-shadow:
            0 20px 50px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
        }

        .auth-page.light .glass-card {
          background: rgba(255, 255, 255, 0.8);
          border-color: #e5e7eb;
          box-shadow:
            0 20px 50px rgba(15, 23, 42, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 1);
        }

        .form-title {
          font-size: 28px;
          font-weight: 800;
          color: #f9fafb;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        .auth-page.light .form-title {
          color: #0f172a;
        }

        .form-subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .auth-page.light .form-subtitle {
          color: #6b7280;
        }

        .organizer-toggle {
          display: inline-flex;
          padding: 4px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.4);
          margin-bottom: 20px;
          gap: 4px;
        }

        .auth-page.light .organizer-toggle {
          background: rgba(248, 250, 252, 0.9);
          border-color: #e5e7eb;
        }

        .toggle-option {
          border: none;
          background: transparent;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 100px;
          text-align: center;
        }

        .toggle-option.active {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #f9fafb;
          box-shadow: 0 6px 15px rgba(79, 70, 229, 0.45);
        }

        .form-scroll-container {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-bottom: 24px;
          max-height: 260px;
          padding-right: 4px;
          overflow-y: auto;
        }

        .form-scroll-container::-webkit-scrollbar {
          width: 6px;
        }

        .form-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .form-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.6);
          border-radius: 999px;
        }

        .auth-page.light .form-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.6);
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #9ca3af;
        }

        .auth-page.light .input-label {
          color: #6b7280;
        }

        .input-field {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: rgba(15, 23, 42, 0.7);
          color: #e5e7eb;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          width: 100%;
        }

        .input-field::placeholder {
          color: #6b7280;
        }

        .input-field:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.5);
          background: rgba(15, 23, 42, 0.9);
        }

        .auth-page.light .input-field {
          background: rgba(255, 255, 255, 0.9);
          color: #111827;
          border-color: #e5e7eb;
        }

        .auth-page.light .input-field::placeholder {
          color: #9ca3af;
        }

        .auth-page.light .input-field:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.4);
          background: #ffffff;
        }

        .input-error {
          border-color: #f87171 !important;
          box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.4);
        }

        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .toggle-password {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #9ca3af;
          transition: background 0.2s ease, color 0.2s ease, transform 0.1s ease;
        }

        .toggle-password svg {
          width: 18px;
          height: 18px;
        }

        .toggle-password:hover {
          background: rgba(15, 23, 42, 0.7);
          color: #e5e7eb;
          transform: translateY(-50%) scale(1.02);
        }

        .auth-page.light .toggle-password:hover {
          background: rgba(243, 244, 246, 1);
          color: #111827;
        }

        .error-message {
          font-size: 12px;
          color: #fecaca;
          margin: 0;
        }

        .auth-page.light .error-message {
          color: #b91c1c;
        }

        .info-message {
          font-size: 12px;
          color: #e5e7eb;
          opacity: 0.85;
          margin: 0;
        }

        .auth-page.light .info-message {
          color: #4b5563;
        }

        .password-requirements {
          font-size: 11px;
          color: #9ca3af;
          margin: 0;
        }

        .auth-page.light .password-requirements {
          color: #6b7280;
        }

        .submit-button {
          width: 100%;
          border-radius: 999px;
          border: none;
          padding: 12px 18px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
          color: #f9fafb;
          margin-top: 8px;
          box-shadow:
            0 14px 35px rgba(79, 70, 229, 0.55),
            0 0 0 1px rgba(148, 163, 184, 0.35);
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }

        .submit-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
          box-shadow:
            0 18px 40px rgba(79, 70, 229, 0.7),
            0 0 0 1px rgba(148, 163, 184, 0.4);
        }

        .submit-button:active {
          transform: translateY(0);
          box-shadow:
            0 8px 22px rgba(79, 70, 229, 0.7),
            0 0 0 1px rgba(148, 163, 184, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .form-switch {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
          color: #9ca3af;
        }

        .auth-page.light .form-switch {
          color: #6b7280;
        }

        .switch-link {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #6366f1;
          cursor: pointer;
          text-decoration: none;
          position: relative;
        }

        .switch-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, #6366f1, #ec4899);
          transform-origin: left;
          transform: scaleX(0);
          transition: transform 0.2s ease;
        }

        .switch-link:hover::after {
          transform: scaleX(1);
        }

        .login-hint {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px dashed rgba(148, 163, 184, 0.7);
          font-size: 12px;
          color: #9ca3af;
        }

        .auth-page.light .login-hint {
          background: rgba(249, 250, 251, 0.95);
          border-color: #cbd5f5;
          color: #4b5563;
        }

        .hint-highlight {
          color: #f9fafb;
          font-weight: 600;
        }

        .auth-page.light .hint-highlight {
          color: #111827;
        }

        /* Responsive */

        @media (max-width: 1024px) {
          .auth-container {
            grid-template-columns: minmax(0, 1fr);
            max-width: 820px;
          }

          .auth-left {
            padding: 40px 32px 20px;
            border-right: none;
            border-bottom: 1px solid rgba(148, 163, 184, 0.25);
          }

          .auth-right {
            padding: 28px 24px 36px;
          }

          .glass-card {
            max-width: 100%;
          }

          .brand-title {
            font-size: 40px;
          }
        }

        @media (max-width: 768px) {
          .auth-page {
            padding: 16px 12px;
          }

          .auth-container {
            border-radius: 24px;
          }

          .auth-left {
            padding: 28px 20px 16px;
          }

          .auth-right {
            padding: 20px 16px 24px;
          }

          .brand-title {
            font-size: 32px;
          }

          .brand-subtitle {
            font-size: 14px;
            margin-bottom: 24px;
          }

          .brand-features {
            gap: 14px;
          }

          .feature-item {
            padding: 12px;
          }

          .glass-card {
            padding: 22px 18px;
          }

          .form-scroll-container {
            max-height: none;
          }

          .global-theme-toggle {
            top: 14px;
            right: 14px;
            padding: 8px 12px;
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .auth-container {
            border-radius: 20px;
          }

          .brand-title {
            font-size: 28px;
          }

          .brand-accent {
            height: 32px;
          }

          .auth-left {
            padding-bottom: 8px;
          }

          .timisoara-skyline {
            display: none;
          }

          .submit-button {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default AuthScreen;