// src/components/MainScreen.jsx
import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://127.0.0.1:5000';

// ====================== MOCK DATA ======================
const MOCK_EVENTS = [
  {
    id: '1',
    title: 'Concert Rock în Timișoara',
    date: '2025-11-20',
    locationName: 'Sala Capitol, Timișoara',
    imageUrl:
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop',
    category: 'Muzică',
    price: 'Gratuit',
    minAge: null,
  },
  {
    id: '2',
    title: 'Festival de teatru',
    date: '2025-11-22',
    locationName: 'Teatrul Național Timișoara',
    imageUrl:
      'https://images.unsplash.com/photo-1503095396549-807759245b35?w=400&h=300&fit=crop',
    category: 'Teatru',
    price: '50 RON',
    minAge: 12,
  },
  {
    id: '3',
    title: 'Târg de Crăciun',
    date: '2025-12-01',
    locationName: 'Piața Victoriei, Timișoara',
    imageUrl:
      'https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=400&h=300&fit=crop',
    category: 'Festival',
    price: 'Gratuit',
    minAge: null,
  },
  {
    id: '4',
    title: 'Jazz Night (18+)',
    date: '2025-11-25',
    locationName: "D'arc Club, Timișoara",
    imageUrl:
      'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&h=300&fit=crop',
    category: 'Muzică',
    price: '40 RON',
    minAge: 18,
  },
  {
    id: '5',
    title: 'Expoziție de Artă Modernă',
    date: '2025-11-28',
    locationName: 'Muzeul de Artă Timișoara',
    imageUrl:
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=300&fit=crop',
    category: 'Artă',
    price: '20 RON',
    minAge: null,
  },
  {
    id: '6',
    title: 'Stand-up Comedy Night (16+)',
    date: '2025-11-30',
    locationName: 'Comedy Club TM',
    imageUrl:
      'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=400&h=300&fit=crop',
    category: 'Entertainment',
    price: '60 RON',
    minAge: 16,
  },
  {
    id: '7',
    title: 'Workshop Fotografie',
    date: '2025-12-03',
    locationName: 'Studio Photo Art, Timișoara',
    imageUrl:
      'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=300&fit=crop',
    category: 'Workshop',
    price: '100 RON',
    minAge: 14,
  },
  {
    id: '8',
    title: 'Concurs de dans',
    date: '2025-12-05',
    locationName: 'Sala Polivalentă, Timișoara',
    imageUrl:
      'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=400&h=300&fit=crop',
    category: 'Sport',
    price: 'Gratuit',
    minAge: null,
  },
];

const CATEGORIES = [
  'Toate',
  'Muzică',
  'Teatru',
  'Festival',
  'Artă',
  'Entertainment',
  'Workshop',
  'Sport',
];

function MainScreen({ theme, onToggleTheme, authToken, currentUser }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('Toate');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);

  // locația reală a utilizatorului (high accuracy)
  const [userLocation, setUserLocation] = useState(null);

  // verificare identitate
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [dob, setDob] = useState('');
  const [idSeries, setIdSeries] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [ageError, setAgeError] = useState('');

  // Chat widget state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { from: 'bot', text: 'Salut! Pot să te ajut cu găsirea unui eveniment?' },
  ]);
  const [chatInput, setChatInput] = useState('');

  const infoCardRef = useRef(null);
  const mapPanelRef = useRef(null);

  // Incarcam evenimentele din backend; daca esueaza, folosim MOCK_EVENTS
  useEffect(() => {
    let isCancelled = false;

    async function loadEvents() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/events`);
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          throw new Error(data.error || data.message || `Eroare ${res.status}`);
        }

        if (!Array.isArray(data) || data.length === 0) {
          if (!isCancelled) {
            setEvents(MOCK_EVENTS);
          }
          return;
        }

        if (!isCancelled) {
          const mapped = data.map((ev) => ({
            id: ev.id,
            title: ev.title || '',
            date: ev.date || '',
            locationName: ev.locationName || '',
            imageUrl: ev.imageUrl || '',
            category: ev.category || 'Eveniment',
            price: ev.price || 'Gratuit',
            minAge: ev.minAge ?? null,
          }));
          setEvents(mapped);
        }
      } catch (err) {
        console.warn('Nu s-au putut incarca evenimentele reale, folosim date mock.', err);
        if (!isCancelled) {
          setEvents(MOCK_EVENTS);
        }
      }
    }

    loadEvents();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedEvent && infoCardRef.current) {
      const isMobile = window.innerWidth <= 768;
      infoCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: isMobile ? 'start' : 'nearest',
      });
    }
  }, [selectedEvent]);

  // MODIFICAT: geolocație cu fallback la precizie scăzută
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocația nu este suportată în acest browser.');
      return;
    }

    const handleSuccess = (pos) => {
      const { latitude, longitude } = pos.coords;
      setUserLocation({ latitude, longitude });
    };

    const handleError = (error) => {
      console.warn('Nu s-a putut obține locația (high-accuracy):', error.message);
      // Dacă a eșuat high-accuracy (ex. timeout), încercăm low-accuracy
      if (error.code === error.TIMEOUT) {
        console.log('Încercăm fallback la low-accuracy...');
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (lowAccError) => {
            console.warn('Eroare și la low-accuracy:', lowAccError.message);
          },
          {
            enableHighAccuracy: false, // Cerem precizie scăzută
            timeout: 10000,
            maximumAge: 60000, // Acceptăm o locație de acum 1 minut
          }
        );
      }
    };

    // 1. Încercăm high-accuracy mai întâi
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesCategory =
      selectedCategory === 'Toate' || event.category === selectedCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryColor = (category) => {
    const colors = {
      Muzică: '#f97373',
      Teatru: '#a855f7',
      Festival: '#f59e0b',
      Artă: '#22c9e8',
      Entertainment: '#ec4899',
      Workshop: '#22c55e',
      Sport: '#3b82f6',
    };
    return colors[category] || '#6366f1';
  };

  const handleShowOnMap = (event) => {
    setSelectedEvent(event);
    if (mapPanelRef.current) {
      mapPanelRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'end',
      });
    }
  };

  // MODIFICAT: CEA MAI PRECISĂ VARIANTĂ POSIBILĂ PENTRU DIRECȚII (cu fallback)
  const handleGetDirections = (event) => {
    if (!event) return;

    const destination = encodeURIComponent(event.locationName);

    const openGoogleMaps = (originCoords) => {
      let url;
      if (originCoords) {
        const origin = encodeURIComponent(
          `${originCoords.latitude},${originCoords.longitude}`
        );
        url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      } else {
        // fallback: fără origin, lasă Google să detecteze
        url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      }
      window.open(url, '_blank');
    };

    // dacă avem deja ceva în state, îl folosim ca fallback
    const fallbackCoords = userLocation
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
      : null;

    if (!navigator.geolocation) {
      console.warn('Geolocația nu este suportată în acest browser.');
      openGoogleMaps(fallbackCoords);
      return;
    }

    // Funcția de succes
    const handleSuccess = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      console.log('Locație obținută pentru direcții:', {
        latitude,
        longitude,
        accuracy,
      });
      openGoogleMaps({ latitude, longitude });
    };

    // Funcția de eroare
    const handleError = (error) => {
      console.warn('Eroare la obținerea locației high-accuracy pentru direcții:', error.message);
      
      // Dacă a fost timeout, încercăm low-accuracy
      if (error.code === error.TIMEOUT) {
        console.log('Încercăm low-accuracy fallback pentru direcții...');
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (lowAccError) => {
            // A eșuat și low-accuracy, folosim fallback-ul (poate fi null)
            console.warn('Eroare finală la obținerea locației:', lowAccError);
            openGoogleMaps(fallbackCoords);
          },
          {
            enableHighAccuracy: false, // Cerem locație rapidă
            timeout: 10000, 
            maximumAge: 60000,
          }
        );
      } else {
        // Altă eroare (ex. Permisiune refuzată), folosim direct fallback
        openGoogleMaps(fallbackCoords);
      }
    };

    // 1. Încercăm high-accuracy (GPS)
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 12000, // 12 secunde pentru o acțiune a utilizatorului
      maximumAge: 0,
    });
  };


  const handleOpenTickets = (event) => {
    if (!authToken) {
      alert(
        'Pentru a rezerva bilete reale trebuie s�� fii autentificat cu un cont (nu ca invitat).'
      );
      return;
    }

    setSelectedEvent(event);
    setTicketCount(1);

    if (event.minAge) {
      setDob('');
      setIdSeries('');
      setIdNumber('');
      setAgeError('');
      setShowAgeModal(true);
    } else {
      setTicketModalOpen(true);
    }
  };

  const handleConfirmAge = () => {
    if (!dob || !idSeries.trim() || !idNumber.trim()) {
      setAgeError('Te rugăm să completezi toate câmpurile.');
      return;
    }

    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      setAgeError('Data nașterii este invalidă.');
      return;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const minAge = selectedEvent?.minAge || 0;
    if (age < minAge) {
      setAgeError(`Acest eveniment este disponibil doar pentru persoane de ${minAge}+ ani.`);
      return;
    }

    setAgeError('');
    setShowAgeModal(false);
    setTicketModalOpen(true);
  };

  const handleConfirmTickets = async () => {
    if (!selectedEvent) {
      setTicketModalOpen(false);
      return;
    }

    if (!authToken) {
      setTicketModalOpen(false);
      alert('Trebuie s�� fii autentificat pentru a rezerva bilete.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          count: ticketCount,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Rezervarea a eE9uat (cod ${res.status}).`;
        alert(message);
      } else {
        alert('Biletele au fost rezervate cu succes! Verific��-TEi email-ul pentru detalii.');
      }
    } catch (error) {
      console.error(error);
      alert('Eroare la conectarea cu serverul de bilete. Asigur��-te c�� backend-ul ruleaz��.');
    } finally {
      setTicketModalOpen(false);
    }
  };

  const computeTotalPrice = () => {
    if (!selectedEvent) return 0;
    if (selectedEvent.price.toLowerCase().includes('gratuit')) return 0;
    const numeric = parseInt(selectedEvent.price);
    if (isNaN(numeric)) return 0;
    return numeric * ticketCount;
  };

  const handleSendChat = async () => {
    const text = (chatInput || '').trim();
    if (!text) return;

    // append user message and clear input
    setChatMessages((m) => [...m, { from: 'user', text }]);
    setChatInput('');

    // show a temporary typing indicator from the bot
    const typingId = Date.now();
    setChatMessages((m) => [...m, { from: 'bot', text: '...', _id: typingId }]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // remove typing and fallback to local reply
        setChatMessages((m) => m.filter((msg) => msg._id !== typingId));
        const fallback = data.error || 'Nu am putut obține un răspuns (server).';
        setChatMessages((m) => [...m, { from: 'bot', text: `Eroare: ${fallback}` }]);
        return;
      }

      const reply = data.reply || data.result || data.text || '';
      // remove typing placeholder and append real reply
      setChatMessages((m) => m.filter((msg) => msg._id !== typingId));
      if (reply) {
        setChatMessages((m) => [...m, { from: 'bot', text: reply }]);
      } else {
        setChatMessages((m) => [...m, { from: 'bot', text: 'Nu am un răspuns la momentul acesta.' }]);
      }
    } catch (err) {
      // network or other error — remove typing and fallback
      setChatMessages((m) => m.filter((msg) => msg._id !== typingId));
      setChatMessages((m) => [...m, { from: 'bot', text: `Eroare de rețea: ${String(err)}` }]);
    }
  };

  // 1) eveniment selectat, 2) locația userului, 3) fallback Timișoara
  const getMapSrc = () => {
    if (selectedEvent) {
      const query = encodeURIComponent(selectedEvent.locationName);
      return `https://www.google.com/maps?q=${query}&z=16&output=embed`;
    }

    if (userLocation) {
      return `https://www.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}&z=15&output=embed`;
    }

    const cityQuery = encodeURIComponent('Timișoara, România');
    return `https://www.google.com/maps?q=${cityQuery}&z=13&output=embed`;
  };

  return (
    <div className={`app ${theme}`}>
      <header className="header">
        <div className="header-content">
          <div className="header-top">
            <div>
              <h1 className="app-title">BegaVibe</h1>
              <p className="app-tagline">Agenda ta inteligentă de evenimente.</p>
            </div>
            <div className="header-actions">
              <button className="theme-toggle" onClick={onToggleTheme}>
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
              <div className="location-badge">
                <span className="location-dot" />
                <span className="location-text">
                  {userLocation ? 'Lângă tine' : 'Timișoara'}
                </span>
              </div>
              <button
                className="header-cta"
                onClick={() => {
                  if (mapPanelRef.current) {
                    mapPanelRef.current.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'end',
                    });
                  }
                }}
              >
                Vezi harta orașului
              </button>
            </div>
          </div>
          <p className="header-subtitle">
            Găsește concerte, festivaluri, expoziții și experiențe cool. Filtrează, explorează și
            cumpără bilete în câteva secunde. Pentru evenimente 16+ / 18+ se face verificare de
            identitate cu buletinul.
          </p>
        </div>
      </header>

      <div className="main-layout">
        <section className="events-panel">
          <div className="panel-inner">
            {/* SEARCH + FILTRE */}
            <div className="search-section">
              <div className="search-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="🔍 Caută după nume, locație, categorie..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filters-section">
                <div className="filters-scroll">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      className={`filter-chip ${
                        selectedCategory === category ? 'active' : ''
                      }`}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="results-info">
                <p>{filteredEvents.length} evenimente găsite</p>
              </div>
            </div>

            {/* LISTĂ EVENIMENTE */}
            <div className="events-grid">
              {filteredEvents.map((event) => (
                <article key={event.id} className="event-card">
                  <div className="event-image-wrapper">
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="event-image"
                    />
                    <div
                      className="event-category-badge"
                      style={{ backgroundColor: getCategoryColor(event.category) }}
                    >
                      {event.category}
                    </div>
                    {event.minAge && <div className="age-badge-card">{event.minAge}+</div>}
                    <div className="event-gradient-overlay" />
                  </div>

                  <div className="event-content">
                    <h3 className="event-title">{event.title}</h3>

                    <div className="event-info-row">
                      <span className="event-icon">📅</span>
                      <span className="event-text">{event.date}</span>
                    </div>

                    <div className="event-info-row">
                      <span className="event-icon">📍</span>
                      <span className="event-text">{event.locationName}</span>
                    </div>

                    {event.minAge && (
                      <div className="event-info-row">
                        <span className="event-icon">🪪</span>
                        <span className="event-text">
                          Verificare identitate pentru {event.minAge}+
                        </span>
                      </div>
                    )}

                    <div className="event-footer">
                      <div className="price-block">
                        <span className="event-price">{event.price}</span>
                        <span className="event-price-label">
                          {event.price.toLowerCase().includes('gratuit')
                            ? 'Intrare liberă'
                            : 'bilet / persoană'}
                        </span>
                      </div>
                      <div className="card-actions">
                        <button
                          className="outline-btn"
                          onClick={() => handleShowOnMap(event)}
                        >
                          Vezi pe hartă
                        </button>
                        <button
                          className="primary-mini-btn"
                          onClick={() => handleOpenTickets(event)}
                        >
                          Cumpără
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PANOU HARTĂ */}
        <section className="map-panel" ref={mapPanelRef}>
          <div className="panel-inner map-panel-inner">
            <div className="map-header">
              <h2 className="map-title">Hartă evenimente</h2>
              <p className="map-subtitle">
                Apasă pe „Vezi pe hartă” la un eveniment, iar harta se va centra pe locația lui.
                Dacă nu ai selectat încă un eveniment, harta se centrează în zona ta (dacă permiți
                locația) sau în Timișoara.
              </p>
            </div>

            <div className="map-container">
              {/* cardul cu detalii deasupra hărții */}
              {selectedEvent ? (
                <aside className="map-info-card" ref={infoCardRef}>
                  <div className="info-header">
                    <span
                      className="info-category"
                      style={{ backgroundColor: getCategoryColor(selectedEvent.category) }}
                    >
                      {selectedEvent.category}
                    </span>
                    {selectedEvent.minAge && (
                      <span className="info-age-pill">{selectedEvent.minAge}+</span>
                    )}
                  </div>
                  <h3 className="info-title">{selectedEvent.title}</h3>
                  <div className="info-row">
                    <span className="info-icon">📍</span>
                    <span>{selectedEvent.locationName}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-icon">📅</span>
                    <span>{selectedEvent.date}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-icon">💰</span>
                    <span>{selectedEvent.price}</span>
                  </div>
                  {selectedEvent.minAge && (
                    <div className="info-row">
                      <span className="info-icon">🪪</span>
                      <span>
                        Acces permis doar persoanelor de {selectedEvent.minAge}+ ani. Verificare la
                        intrare pe baza buletinului.
                      </span>
                    </div>
                  )}

                  <div className="info-actions">
                    <button
                      className="get-directions-btn"
                      onClick={() => handleGetDirections(selectedEvent)}
                    >
                      Obține direcții
                    </button>
                    <button
                      className="secondary-btn"
                      onClick={() => handleOpenTickets(selectedEvent)}
                    >
                      Cumpără bilete
                    </button>
                  </div>
                </aside>
              ) : (
                <aside className="map-empty-state">
                  <span className="empty-icon">🗺️</span>
                  <p>Selectează „Vezi pe hartă” la un eveniment pentru a-l vedea pe hartă.</p>
                </aside>
              )}

              {/* HARTA MĂRITĂ */}
              <div className="map-view">
                <iframe
                  title="Harta eveniment"
                  src={getMapSrc()}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* MODAL VERIFICARE IDENTITATE */}
      {showAgeModal && selectedEvent && (
        <div className="ticket-modal-backdrop" onClick={() => setShowAgeModal(false)}>
          <div
            className="ticket-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ticket-modal-header">
              <h3>Verificare identitate</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAgeModal(false)}
              >
                ×
              </button>
            </div>
            <p className="ticket-event-name">{selectedEvent.title}</p>
            <p className="ticket-event-meta">
              Acest eveniment este pentru {selectedEvent.minAge}+ ani. Introdu datele din buletin.
            </p>

            <div className="ticket-row">
              <label>Data nașterii</label>
              <input
                type="date"
                className="age-input"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div className="ticket-row">
              <label>Seria buletinului</label>
              <input
                type="text"
                className="age-input"
                value={idSeries}
                onChange={(e) => setIdSeries(e.target.value)}
                placeholder="Ex: TM"
              />
            </div>
            <div className="ticket-row">
              <label>Numărul buletinului</label>
              <input
                type="text"
                className="age-input"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="Ex: 123456"
              />
            </div>

            {ageError && <p className="age-error">{ageError}</p>}

            <button
              className="ticket-confirm-btn"
              onClick={handleConfirmAge}
            >
              Confirmă identitatea
            </button>
          </div>
        </div>
      )}

      {/* MODAL BILETE */}
      {ticketModalOpen && selectedEvent && (
        <div className="ticket-modal-backdrop" onClick={() => setTicketModalOpen(false)}>
          <div
            className="ticket-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ticket-modal-header">
              <h3>Cumpără bilete</h3>
              <button
                className="modal-close-btn"
                onClick={() => setTicketModalOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="ticket-event-name">{selectedEvent.title}</p>
            <p className="ticket-event-meta">
              📅 {selectedEvent.date} · 📍 {selectedEvent.locationName}
            </p>

            <div className="ticket-row">
              <label>Număr bilete</label>
              <div className="ticket-counter">
                <button
                  onClick={() => setTicketCount((prev) => (prev > 1 ? prev - 1 : 1))}
                >
                  -
                </button>
                <span>{ticketCount}</span>
                <button
                  onClick={() => setTicketCount((prev) => (prev < 10 ? prev + 1 : 10))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="ticket-row">
              <label>Preț</label>
              {selectedEvent.price.toLowerCase().includes('gratuit') ? (
                <span className="ticket-free">Eveniment gratuit</span>
              ) : (
                <span className="ticket-price-line">
                  {selectedEvent.price} x {ticketCount} ={' '}
                  <strong>{computeTotalPrice()} RON</strong>
                </span>
              )}
            </div>

            <button
              className="ticket-confirm-btn"
              onClick={handleConfirmTickets}
            >
              Confirmă comanda
            </button>
          </div>
        </div>
      )}

            {/* CSS */}
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        .app {
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
          background: radial-gradient(circle at top left, #020617 0%, #020617 30%, #020617 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #e5e7eb;
        }

        .app.light {
          background: #f3f4f6;
          color: #111827;
        }

        .header {
          background: radial-gradient(circle at top, rgba(56, 189, 248, 0.18), transparent 60%),
            linear-gradient(135deg, #111827 0%, #020617 60%, #020617 100%);
          padding: 24px 16px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.35);
        }

        .app.light .header {
          background: linear-gradient(135deg, #e5e7eb 0%, #f9fafb 100%);
          border-bottom-color: #e5e7eb;
        }

        .header-content {
          max-width: none;
          width: 100%;
          margin: 0 auto;
          padding-left: 24px;
          padding-right: 24px;
          box-sizing: border-box;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }

        .app-title {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.6px;
          color: #f9fafb;
        }

        .app.light .app-title {
          color: #111827;
        }

        .app-tagline {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .app.light .app-tagline {
          color: #4b5563;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .theme-toggle {
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.8);
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .app.light .theme-toggle {
          background: #f9fafb;
          color: #111827;
        }

        .location-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.4);
        }

        .app.light .location-badge {
          background: #ffffff;
          border-color: #e5e7eb;
        }

        .location-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.35);
        }

        .location-text {
          font-size: 12px;
          font-weight: 600;
          color: #e5e7eb;
        }

        .app.light .location-text {
          color: #111827;
        }

        .header-cta {
          padding: 9px 14px;
          border-radius: 999px;
          border: 1px solid rgba(56, 189, 248, 0.8);
          background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.25), rgba(15, 23, 42, 0.95));
          color: #e0f2fe;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.6);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .app.light .header-cta {
          background: #0ea5e9;
          color: #f0f9ff;
        }

        .header-subtitle {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 4px;
          max-width: 900px;
        }

        .app.light .header-subtitle {
          color: #6b7280;
        }

        /* LAYOUT PRINCIPAL */
        .main-layout {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding: 18px 16px 26px;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
        }

        .events-panel,
        .map-panel {
          flex: 0 0 100%;
          scroll-snap-align: start;
        }

        .panel-inner {
          background: rgba(15, 23, 42, 0.95);
          border-radius: 18px;
          padding: 16px 14px 18px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.9);
        }

        .app.light .panel-inner {
          background: #ffffff;
          border-color: #e5e7eb;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .map-panel-inner {
          height: 100%;
        }

        /* SEARCH + FILTRE */
        .search-section {
          margin-bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .search-bar {
          width: 100%;
        }

        .search-input {
          width: 100%;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          padding: 9px 14px;
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
          font-size: 13px;
        }

        .search-input::placeholder {
          color: #6b7280;
        }

        .app.light .search-input {
          background: #f9fafb;
          border-color: #d1d5db;
          color: #111827;
        }

        .filters-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .filters-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 2px;
        }

        .filter-chip {
          flex-shrink: 0;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: rgba(15, 23, 42, 0.8);
          color: #e5e7eb;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .filter-chip.active {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-color: transparent;
          color: #f9fafb;
        }

        .app.light .filter-chip {
          background: #f9fafb;
          border-color: #d1d5db;
          color: #111827;
        }

        .results-info {
          font-size: 11px;
          color: #9ca3af;
        }

        .app.light .results-info {
          color: #6b7280;
        }

        /* LISTĂ EVENIMENTE */
        .events-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .event-card {
          position: relative;
          background: rgba(15, 23, 42, 0.98);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.6);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.9);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
        }

        .event-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.95);
          border-color: rgba(129, 140, 248, 0.9);
          background: rgba(15, 23, 42, 1);
        }

        .app.light .event-card {
          background: #f9fafb;
          border-color: #e5e7eb;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .app.light .event-card:hover {
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.16);
          border-color: #6366f1;
        }

        .event-image-wrapper {
          position: relative;
          height: 150px;
          overflow: hidden;
        }

        .event-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: scale(1.02);
          transition: transform 0.25s ease;
        }

        .event-card:hover .event-image {
          transform: scale(1.06);
        }

        .event-gradient-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.9) 100%);
        }

        /* BADGE-URI MUTATE MAI SUS */
        .event-category-badge {
          position: absolute;
          left: 10px;
          top: 10px;
          padding: 5px 10px;
          border-radius: 999px;
          color: #f9fafb;
          font-size: 10px;
          font-weight: 700;
          backdrop-filter: blur(14px);
          border: 1px solid rgba(248, 250, 252, 0.5);
        }

        .age-badge-card {
          position: absolute;
          right: 10px;
          top: 10px;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.85);
          color: #f9fafb;
          font-size: 10px;
          font-weight: 700;
        }

        .event-content {
          padding: 12px 12px 12px;
        }

        .event-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .event-info-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 12px;
          color: #9ca3af;
        }

        .app.light .event-info-row {
          color: #6b7280;
        }

        .event-footer {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed rgba(75, 85, 99, 0.8);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .app.light .event-footer {
          border-top-color: #e5e7eb;
        }

        .price-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .event-price {
          font-size: 15px;
          font-weight: 800;
          color: #a5b4fc;
        }

        .event-price-label {
          font-size: 10px;
          color: #6b7280;
        }

        .card-actions {
          display: flex;
          gap: 6px;
        }

        .outline-btn {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: transparent;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          color: #e5e7eb;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .outline-btn:hover {
          background: rgba(15, 23, 42, 0.85);
          border-color: rgba(148, 163, 184, 0.95);
        }

        .app.light .outline-btn {
          background: #ffffff;
          border-color: #d1d5db;
          color: #111827;
        }

        .app.light .outline-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .primary-mini-btn {
          padding: 6px 12px;
          border-radius: 999px;
          border: none;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #f9fafb;
          white-space: nowrap;
          transition: filter 0.15s ease, transform 0.12s ease;
        }

        .primary-mini-btn:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }

        /* HARTĂ */
        .map-header {
          margin-bottom: 10px;
        }

        .map-title {
          font-size: 17px;
          font-weight: 800;
        }

        .map-subtitle {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .app.light .map-subtitle {
          color: #6b7280;
        }

        .map-container {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .map-view {
          background: #000;
          border-radius: 16px;
          height: 420px;
          position: relative;
          box-shadow: 0 0 0 1px rgba(30, 64, 175, 0.5);
          overflow: hidden;
        }

        .map-view iframe {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
        }

        .app.light .map-view {
          box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.6);
        }

        .map-info-card,
        .map-empty-state {
          background: rgba(15, 23, 42, 0.97);
          border-radius: 16px;
          padding: 14px 12px;
          border: 1px solid rgba(148, 163, 184, 0.6);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.9);
        }

        .app.light .map-info-card,
        .app.light .map-empty-state {
          background: #f9fafb;
          border-color: #e5e7eb;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
        }

        .info-header {
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .info-category {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          color: #f9fafb;
          font-size: 10px;
          font-weight: 700;
          border: 1px solid rgba(248, 250, 252, 0.7);
        }

        .info-age-pill {
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.9);
          color: #f9fafb;
          font-size: 10px;
          font-weight: 700;
        }

        .app.light .info-age-pill {
          background: #111827;
          color: #f9fafb;
        }

        .info-title {
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 5px;
          font-size: 12px;
          color: #9ca3af;
        }

        .app.light .info-row {
          color: #6b7280;
        }

        .info-actions {
          margin-top: 10px;
          display: flex;
          gap: 8px;
        }

        .get-directions-btn {
          flex: 1;
          padding: 7px 10px;
          border-radius: 999px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: #22c55e;
          color: #052e16;
        }

        .secondary-btn {
          flex: 1;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: #e5e7eb;
        }

        .app.light .secondary-btn {
          background: #ffffff;
          border-color: #d1d5db;
          color: #111827;
        }

        .map-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
        }

        .empty-icon {
          font-size: 20px;
        }

        /* MODAL BILETE / VERIFICARE IDENTITATE */
        .ticket-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .ticket-modal {
          width: 100%;
          max-width: 380px;
          background: rgba(15, 23, 42, 0.98);
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          padding: 16px 14px 14px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.9);
        }

        .ticket-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .ticket-modal-header h3 {
          font-size: 16px;
          font-weight: 800;
        }

        .modal-close-btn {
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 18px;
          cursor: pointer;
        }

        .ticket-event-name {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .ticket-event-meta {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 10px;
        }

        .ticket-row {
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
        }

        .ticket-counter {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
        }

        .ticket-counter button {
          border: none;
          background: transparent;
          color: #e5e7eb;
          font-size: 14px;
          cursor: pointer;
        }

        .ticket-counter span {
          min-width: 18px;
          text-align: center;
        }

        .ticket-free {
          color: #4ade80;
          font-weight: 600;
        }

        .ticket-price-line {
          color: #e5e7eb;
        }

        .ticket-confirm-btn {
          width: 100%;
          margin-top: 4px;
          padding: 9px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #f9fafb;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .age-input {
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          padding: 7px 10px;
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
          font-size: 12px;
        }

        .age-error {
          color: #f97373;
          font-size: 12px;
          margin-top: 4px;
        }

        /* RESPONSIVE DESKTOP */
        @media (min-width: 900px) {
          .main-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
            overflow-x: visible;
            scroll-snap-type: none;
          }

          .events-panel,
          .map-panel {
            flex: initial;
            scroll-snap-align: none;
          }

          .panel-inner {
            height: 100%;
          }

          .events-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .map-view {
            height: 460px;
          }
        }

        /* RESPONSIVE TABLET / SMALL */
        @media (max-width: 768px) {
          .header-top {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
            justify-content: space-between;
          }

          .map-view {
            height: 360px;
          }

          .panel-inner {
            padding: 16px 12px 18px;
          }
        }

        /* TELEFOANE FOARTE MICI (sub ~360px) */
        @media (max-width: 360px) {
          .app-title {
            font-size: 24px;
          }

          .header {
            padding: 18px 10px 12px;
          }

          .main-layout {
            padding: 14px 10px 20px;
          }

          .event-title {
            font-size: 14px;
          }

          .map-view {
            height: 320px;
          }
        }

        /* CHAT WIDGET */
        .chat-button {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 54px;
          height: 54px;
          border-radius: 999px;
          background: linear-gradient(135deg,#6366f1,#06b6d4);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(2,6,23,0.5);
          border: none;
          cursor: pointer;
          z-index: 1200;
          font-size: 20px;
        }

        .chat-window {
          position: fixed;
          right: 20px;
          bottom: 86px;
          width: 320px;
          max-width: calc(100% - 40px);
          height: 420px;
          background: rgba(8,10,20,0.98);
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,0.12);
          box-shadow: 0 20px 50px rgba(2,6,23,0.6);
          display: none;
          flex-direction: column;
          overflow: hidden;
          z-index: 1199;
        }

        .chat-window.open {
          display: flex;
        }

        .chat-header {
          padding: 10px 12px;
          background: linear-gradient(90deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08));
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          font-weight:700;
        }

        .chat-close { background: transparent; border: none; color: #cbd5e1; font-size: 18px; cursor: pointer }

        .chat-messages { padding: 10px; flex:1; overflow:auto; display:flex; flex-direction:column; gap:8px }
        .chat-msg { max-width: 86%; padding: 8px 10px; border-radius: 10px; font-size: 13px }
        .chat-msg.bot { align-self:flex-start; background: rgba(148,163,184,0.08); color:#e6eef8 }
        .chat-msg.user { align-self:flex-end; background: linear-gradient(135deg,#6366f1,#a855f7); color:#fff }

        .chat-input-row { display:flex; gap:8px; padding:10px; border-top:1px solid rgba(148,163,184,0.04) }
        .chat-input-row input { flex:1; padding:8px 10px; border-radius:8px; border:1px solid rgba(148,163,184,0.08); background:transparent; color:inherit }
        .chat-input-row button { padding:8px 10px; border-radius:8px; background:linear-gradient(135deg,#06b6d4,#6366f1); color:#fff; border:none; cursor:pointer }
      `}</style>

      {/* CHAT WIDGET MARKUP */}
      <div className={`chat-window ${chatOpen ? 'open' : ''}`} role="dialog" aria-label="Chat bot">
        <div className="chat-header">
          <strong>BegaVibe Assistant</strong>
          <button className="chat-close" onClick={() => setChatOpen(false)}>×</button>
        </div>
        <div className="chat-messages">
          {chatMessages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.from}`}>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
            placeholder="Scrie un mesaj..."
          />
          <button onClick={handleSendChat}>Trimite</button>
        </div>
      </div>

      <button
        className="chat-button"
        aria-label="Open chat"
        onClick={() => setChatOpen((s) => !s)}
      >
        💬
      </button>

    </div>
  );
}

export default MainScreen;
