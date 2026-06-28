// src/pages/OrganizerDashboard.jsx
import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://127.0.0.1:5000';

const MOCK_ORG_EVENTS = [
  {
    id: '1',
    title: 'Concert Rock în Timișoara',
    date: '2025-11-20',
    status: 'Publicat',
    location: 'Sala Capitol, Timișoara',
    organizerName: 'Asociația Rock TM',
    cui: '12345678',
    price: '75',
    mapLink: 'https://www.google.com/maps?q=Sala+Capitol+Timisoara',
  },
  {
    id: '2',
    title: 'Stand-up Night',
    date: '2025-12-05',
    status: 'În draft',
    location: 'Comedy Club TM',
    organizerName: 'Funny Events SRL',
    cui: '87654321',
    price: '50',
    mapLink: '',
  },
];

const BANNED_WORDS = [
  'injuratura',
  'obscen',
  'jignire',
  'hate',
];

const isNumericOnly = (value) => /^[0-9]+$/.test(value.trim());
const isValidPrice = (value) => /^([0-9]+)(\.[0-9]{1,2})?$/.test(value.trim());
const isValidCui = (value) => /^[0-9]{6,10}$/.test(value.trim());
const containsBannedWords = (value) => {
  const lower = value.toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w));
};

const mapApiEventToUi = (apiEv) => ({
  id: apiEv.id,
  title: apiEv.title || '',
  date: apiEv.date || '',
  status: apiEv.status === 'published' ? 'Publicat' : 'AZn draft',
  location: apiEv.locationName || '',
  organizerName: '',
  cui: '',
  price: apiEv.price || '',
  mapLink: '',
});

function OrganizerDashboard({ theme, onToggleTheme, onLogout, authToken, currentUser, email }) {
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    location: '',
    organizerName: '',
    cui: '',
    price: '',
    mapLink: '',
  });

    const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingEvent, setEditingEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // incarcam evenimentele organizatorului din backend; daca esueaza, folosim mock
    if (!authToken) {
      setEvents(MOCK_ORG_EVENTS);
      return;
    }

    let cancelled = false;

    async function loadEvents() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/organizers/me/events`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(data.error || data.message || `Eroare ${res.status}`);
        }
        if (!cancelled && Array.isArray(data)) {
          setEvents(data.map(mapApiEventToUi));
        }
      } catch (err) {
        console.warn('Nu s-au putut incarca evenimentele organizatorului, folosim date mock.', err);
        if (!cancelled) {
          setEvents(MOCK_ORG_EVENTS);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [authToken]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEvent((prev) => ({ ...prev, [name]: value }));
  };

  const validateTextFields = ({ title, location, organizerName }) => {
    if (isNumericOnly(title) || isNumericOnly(location) || isNumericOnly(organizerName)) {
      alert('Titlul, locația și numele organizatorului nu pot fi formate doar din cifre.');
      return false;
    }

    if (
      containsBannedWords(title) ||
      containsBannedWords(location) ||
      containsBannedWords(organizerName)
    ) {
      alert('Te rog folosește un limbaj adecvat (fără cuvinte obscure/obscene).');
      return false;
    }

    return true;
  };

    const handleCreateEvent = async (e) => {
    e.preventDefault();

    const {
      title,
      date,
      location,
      organizerName,
      cui,
      price,
      mapLink,
    } = newEvent;

    const trimmedTitle = (title || '').trim();
    const trimmedDate = (date || '').trim();
    const trimmedLocation = (location || '').trim();
    const trimmedOrgName = (organizerName || '').trim();
    const trimmedCui = (cui || '').trim();
    const trimmedPrice = (price || '').trim();
    const trimmedMapLink = (mapLink || '').trim();

    if (
      !trimmedTitle ||
      !trimmedDate ||
      !trimmedLocation ||
      !trimmedOrgName ||
      !trimmedCui ||
      !trimmedPrice
    ) {
      alert('Te rog completeaza toate campurile obligatorii (inclusiv nume organizator, CUI si pret).');
      return;
    }

    if (!validateTextFields({ title: trimmedTitle, location: trimmedLocation, organizerName: trimmedOrgName })) return;

    if (!isValidCui(trimmedCui)) {
      alert('CUI-ul trebuie sa contina doar cifre si sa aiba intre 6 si 10 caractere.');
      return;
    }

    if (!isValidPrice(trimmedPrice)) {
      alert('Pretul trebuie sa fie un numar valid (ex: 50 sau 49.99).');
      return;
    }

    if (!authToken) {
      alert('Trebuie sa fii autentificat ca organizator pentru a crea evenimente reale.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/organizers/me/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: trimmedTitle,
          date: trimmedDate,
          locationName: trimmedLocation,
          price: trimmedPrice,
          status: 'draft',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Crearea evenimentului a esuat (cod ${res.status}).`;
        alert(message);
        return;
      }

      const apiEv = data;
      const mapped = mapApiEventToUi(apiEv);
      const merged = {
        ...mapped,
        organizerName: trimmedOrgName,
        cui: trimmedCui,
        mapLink: trimmedMapLink,
      };

      setEvents((prev) => [merged, ...prev]);
      setNewEvent({
        title: '',
        date: '',
        location: '',
        organizerName: '',
        cui: '',
        price: '',
        mapLink: '',
      });
      alert('Eveniment creat ca draft pentru organizator (salvat in baza de date).');
    } catch (error) {
      console.error(error);
      alert('Eroare la conectarea cu serverul pentru crearea evenimentului.');
    }
  };

    const handleDeleteEvent = async (id) => {
    if (!authToken) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setShowDeleteConfirm(null);
      alert('Eveniment sters doar local (fara backend).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Stergerea evenimentului a esuat (cod ${res.status}).`;
        alert(message);
        return;
      }
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setShowDeleteConfirm(null);
      alert('Eveniment sters cu succes (salvat in baza de date).');
    } catch (err) {
      console.error(err);
      alert('Eroare la conectarea cu serverul pentru stergerea evenimentului.');
    }
  };


    const handleToggleStatus = async (id) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;

    const newStatusApi = ev.status === 'Publicat' ? 'draft' : 'published';

    if (!authToken) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: newStatusApi === 'published' ? 'Publicat' : 'AZn draft' }
            : e
        )
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: newStatusApi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Actualizarea statusului a esuat (cod ${res.status}).`;
        alert(message);
        return;
      }
      const updated = mapApiEventToUi(data);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === updated.id ? { ...e, status: updated.status } : e
        )
      );
    } catch (err) {
      console.error(err);
      alert('Eroare la conectarea cu serverul pentru actualizarea statusului.');
    }
  };


  const handleEditEvent = (event) => {
    setEditingEvent({
      ...event,
      organizerName: event.organizerName || '',
      cui: event.cui || '',
      price: event.price || '',
      mapLink: event.mapLink || '',
    });
  };

  const handleSaveEdit = async () => {
  if (!editingEvent) return;

  const {
    title,
    date,
    location,
    organizerName,
    cui,
    price,
  } = editingEvent;

  if (
    !title.trim() ||
    !date.trim() ||
    !location.trim() ||
    !organizerName.trim() ||
    !cui.trim() ||
    !price.trim()
  ) {
    alert('Te rog completeaza toate campurile obligatorii.');
    return;
  }

  if (!validateTextFields({ title, location, organizerName })) return;

  if (!isValidCui(cui)) {
    alert('CUI-ul trebuie sa contina doar cifre si sa aiba intre 6 si 10 caractere.');
    return;
  }

  if (!isValidPrice(price)) {
    alert('Pretul trebuie sa fie un numar valid (ex: 50 sau 49.99).');
    return;
  }

  if (!authToken) {
    setEvents((prev) =>
      prev.map((e) => (e.id === editingEvent.id ? editingEvent : e))
    );
    setEditingEvent(null);
    alert('Eveniment actualizat doar local (fara backend).');
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/events/${encodeURIComponent(editingEvent.id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          date: date.trim(),
          locationName: location.trim(),
          price: price.trim(),
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        data.error ||
        data.message ||
        `Actualizarea evenimentului a esuat (cod ${res.status}).`;
      alert(message);
      return;
    }

    const updated = mapApiEventToUi(data);
    setEvents((prev) =>
      prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
    );
    setEditingEvent(null);
    alert('Eveniment actualizat cu succes (salvat in baza de date).');
  } catch (err) {
    console.error(err);
    alert('Eroare la conectarea cu serverul pentru actualizarea evenimentului.');
  }
};


  const handleCancelEdit = () => {
    setEditingEvent(null);
  };

  const filteredEvents = events.filter((ev) => {
    if (statusFilter !== 'ALL' && ev.status !== statusFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        ev.title,
        ev.location,
        ev.organizerName,
        ev.cui,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  return (
    <div className={`organizer-app ${theme === 'light' ? 'light' : ''}`}>
      <div className="org-glass-container">
        <header className="org-header">
          <div className="org-header-left">
            <div className="org-logo-area">
              <div className="org-logo-circle">BV</div>
              <div>
                <h1>Organizer Dashboard</h1>
                <p>Gestionează-ți evenimentele ușor și rapid</p>
              </div>
            </div>
          </div>

          <div className="org-header-right">
            <button
              className="org-theme-toggle"
              onClick={onToggleTheme}
              aria-label="Schimbă tema"
            >
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
            <button className="org-logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="org-main">
          <section className="org-create-section">
            <h2>Adaugă un nou eveniment</h2>
            <p className="org-section-subtitle">
              Completează detaliile evenimentului. Implicit, evenimentul va fi creat ca{' '}
              <strong>În draft</strong>.
            </p>
            <form className="org-form" onSubmit={handleCreateEvent}>
              <div className="org-form-row">
                <div className="org-form-group">
                  <label htmlFor="organizerName">
                    Nume organizator <span className="org-required">*</span>
                  </label>
                  <input
                    id="organizerName"
                    name="organizerName"
                    type="text"
                    value={newEvent.organizerName}
                    onChange={handleInputChange}
                    placeholder="Ex: Firma Evenimente SRL"
                  />
                </div>
                <div className="org-form-group">
                  <label htmlFor="cui">
                    CUI <span className="org-required">*</span>
                  </label>
                  <input
                    id="cui"
                    name="cui"
                    type="text"
                    value={newEvent.cui}
                    onChange={handleInputChange}
                    placeholder="Doar cifre, ex: 12345678"
                  />
                </div>
              </div>

              <div className="org-form-row">
                <div className="org-form-group">
                  <label htmlFor="title">
                    Titlu eveniment <span className="org-required">*</span>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={newEvent.title}
                    onChange={handleInputChange}
                    placeholder="Ex: Festival de Jazz"
                  />
                </div>
                <div className="org-form-group">
                  <label htmlFor="date">
                    Dată <span className="org-required">*</span>
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    value={newEvent.date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="org-form-row">
                <div className="org-form-group">
                  <label htmlFor="location">
                    Locație <span className="org-required">*</span>
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    value={newEvent.location}
                    onChange={handleInputChange}
                    placeholder="Ex: Piața Unirii, Timișoara"
                  />
                </div>
                <div className="org-form-group">
                  <label htmlFor="price">
                    Preț bilet (RON) <span className="org-required">*</span>
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="text"
                    value={newEvent.price}
                    onChange={handleInputChange}
                    placeholder="Ex: 50 sau 49.99"
                  />
                </div>
              </div>

              <div className="org-form-group">
                <label htmlFor="mapLink">
                  Link hartă (Google Maps)
                  <span className="org-optional"> (opțional)</span>
                </label>
                <input
                  id="mapLink"
                  name="mapLink"
                  type="text"
                  value={newEvent.mapLink}
                  onChange={handleInputChange}
                  placeholder="Ex: https://www.google.com/maps/..."
                />
                <p className="org-helper-text">
                  Poți deschide Google Maps, cauți locația și copiezi link-ul aici.
                </p>
              </div>

              <div className="org-form-footer">
                <div className="org-info">
                  <span className="org-badge draft">În draft implicit</span>
                  <span>Poți publica evenimentul ulterior din listă.</span>
                </div>
                <button type="submit" className="org-primary-btn">
                  + Creează eveniment
                </button>
              </div>
            </form>
          </section>

          <section className="org-events-section">
            <div className="org-events-header">
              <div>
                <h2>Evenimentele tale</h2>
                <p className="org-section-subtitle">
                  Vezi, filtrează și gestionează evenimentele pe care le-ai creat.
                </p>
              </div>
              <div className="org-filters">
                <div className="org-search">
                  <input
                    type="text"
                    placeholder="Caută după titlu, locație, organizator..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="org-status-filters">
                  <button
                    className={`org-filter-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('ALL')}
                  >
                    Toate
                  </button>
                  <button
                    className={`org-filter-btn ${statusFilter === 'Publicat' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('Publicat')}
                  >
                    Publicate
                  </button>
                  <button
                    className={`org-filter-btn ${statusFilter === 'În draft' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('În draft')}
                  >
                    Drafturi
                  </button>
                </div>
              </div>
            </div>

            {sortedEvents.length === 0 ? (
              <div className="org-empty-state">
                <div className="org-empty-icon">🎫</div>
                <h3>Nu ai niciun eveniment în această vizualizare</h3>
                <p>
                  Creează un eveniment nou sau modifică filtrele pentru a vedea alte rezultate.
                </p>
              </div>
            ) : (
              <div className="org-events-list">
                {sortedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`org-event-card ${
                      ev.status === 'Publicat' ? 'published' : 'draft'
                    }`}
                  >
                    <div className="org-event-main">
                      <h3>{ev.title}</h3>
                      <p>📅 {ev.date || 'Dată necompletată'}</p>
                      {ev.location && <p>📍 {ev.location}</p>}
                      {ev.organizerName && (
                        <p>👤 Organizator: {ev.organizerName}</p>
                      )}
                      {ev.cui && <p>🧾 CUI: {ev.cui}</p>}
                      {ev.price && (
                        <p>💸 Preț: {ev.price} RON</p>
                      )}
                      {ev.mapLink && (
                        <p>
                          🗺️{' '}
                          <a
                            href={ev.mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="org-map-link"
                          >
                            Vezi pe hartă
                          </a>
                        </p>
                      )}
                    </div>
                    <div className="org-event-actions">
                      <span
                        className={`org-status-badge ${
                          ev.status === 'Publicat' ? 'published' : 'draft'
                        }`}
                      >
                        {ev.status}
                      </span>

                      {/* Buton nou de toggling draft/publicat */}
                      <button
                        className={`org-toggle-status-btn ${
                          ev.status === 'Publicat' ? 'to-draft' : 'to-published'
                        }`}
                        onClick={() => handleToggleStatus(ev.id)}
                        title={
                          ev.status === 'Publicat'
                            ? 'Marchează evenimentul ca draft'
                            : 'Publică evenimentul'
                        }
                      >
                        <span className="org-toggle-pill">
                          <span className="dot" />
                          {ev.status === 'Publicat' ? 'Mută în draft' : 'Publică acum'}
                        </span>
                      </button>

                      <button
                        className="org-action-btn edit"
                        onClick={() => handleEditEvent(ev)}
                        title="Editează eveniment"
                      >
                        ✏️
                      </button>
                      <button
                        className="org-action-btn delete"
                        onClick={() => setShowDeleteConfirm(ev.id)}
                        title="Șterge eveniment"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {editingEvent && (
          <div className="org-modal-backdrop">
            <div className="org-modal">
              <h2>Editează evenimentul</h2>
              <div className="org-modal-body">
                <div className="org-form-group">
                  <label>Nume organizator *</label>
                  <input
                    type="text"
                    value={editingEvent.organizerName}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        organizerName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="org-form-group">
                  <label>CUI *</label>
                  <input
                    type="text"
                    value={editingEvent.cui}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        cui: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="org-form-group">
                  <label>Titlu *</label>
                  <input
                    type="text"
                    value={editingEvent.title}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        title: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="org-form-group">
                  <label>Dată *</label>
                  <input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="org-form-group">
                  <label>Locație *</label>
                  <input
                    type="text"
                    value={editingEvent.location}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="org-form-group">
                  <label>Preț bilet (RON) *</label>
                  <input
                    type="text"
                    value={editingEvent.price}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        price: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="org-form-group">
                  <label>Link hartă (Google Maps)</label>
                  <input
                    type="text"
                    value={editingEvent.mapLink}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        mapLink: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="org-modal-footer">
                <button className="org-secondary-btn" onClick={handleCancelEdit}>
                  Anulează
                </button>
                <button className="org-primary-btn" onClick={handleSaveEdit}>
                  Salvează
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="org-modal-backdrop">
            <div className="org-modal">
              <h2>Ștergi acest eveniment?</h2>
              <p>
                Această acțiune nu poate fi anulată. Ești sigur că vrei să continui?
              </p>
              <div className="org-modal-footer">
                <button
                  className="org-secondary-btn"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  Anulează
                </button>
                <button
                  className="org-danger-btn"
                  onClick={() => handleDeleteEvent(showDeleteConfirm)}
                >
                  Șterge
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          margin: 0;
          padding: 0;
        }

        .organizer-app {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.15), transparent 50%),
                      radial-gradient(circle at bottom right, rgba(147, 51, 234, 0.15), transparent 50%),
                      #020617;
          color: #e5e7eb;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 24px;
        }

        .organizer-app.light {
          background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.2), transparent 50%),
                      radial-gradient(circle at bottom right, rgba(147, 51, 234, 0.2), transparent 50%),
                      #f3f4f6;
          color: #111827;
        }

        .org-glass-container {
          width: 100%;
          max-width: 1120px;
          background: rgba(15, 23, 42, 0.9);
          border-radius: 24px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.7);
          overflow: hidden;
          backdrop-filter: blur(24px);
        }

        .organizer-app.light .org-glass-container {
          background: rgba(249, 250, 251, 0.9);
          border-color: rgba(209, 213, 219, 0.8);
          box-shadow: 0 24px 60px rgba(148, 163, 184, 0.4);
        }

        .org-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.3);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(20px);
        }

        .organizer-app.light .org-header {
          background: linear-gradient(to right, rgba(239, 246, 255, 0.9), rgba(249, 250, 251, 0.9));
          border-bottom-color: rgba(209, 213, 219, 0.9);
        }

        .org-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .org-logo-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .org-logo-circle {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: radial-gradient(circle at top left, #38bdf8, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #0b1120;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.5);
        }

        .organizer-app.light .org-logo-circle {
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.35);
        }

        .org-logo-area h1 {
          font-size: 20px;
          font-weight: 600;
        }

        .org-logo-area p {
          font-size: 13px;
          opacity: 0.8;
        }

        .org-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .org-theme-toggle {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.85);
          color: inherit;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .organizer-app.light .org-theme-toggle {
          background: rgba(255, 255, 255, 0.9);
        }

        .org-theme-toggle:hover {
          border-color: rgba(129, 140, 248, 0.9);
          box-shadow: 0 8px 22px rgba(30, 64, 175, 0.6);
          transform: translateY(-1px);
        }

        .org-logout-btn {
          padding: 8px 14px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #ef4444, #f97316);
          color: #f9fafb;
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 10px 25px rgba(248, 113, 113, 0.65);
          transition: all 0.2s;
        }

        .org-logout-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 35px rgba(248, 113, 113, 0.9);
        }

        .organizer-app.light .org-logout-btn {
          box-shadow: 0 10px 25px rgba(248, 113, 113, 0.6);
        }

        .org-main {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.5fr);
          gap: 24px;
          padding: 20px 24px 24px;
        }

        @media (max-width: 960px) {
          .org-main {
            grid-template-columns: 1fr;
          }
        }

        .org-create-section,
        .org-events-section {
          background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 55%),
                      radial-gradient(circle at bottom right, rgba(147, 51, 234, 0.08), transparent 55%),
                      rgba(15, 23, 42, 0.95);
          border-radius: 20px;
          padding: 18px 18px 20px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.7);
          position: relative;
          overflow: hidden;
        }

        .organizer-app.light .org-create-section,
        .organizer-app.light .org-events-section {
          background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.05), transparent 55%),
                      radial-gradient(circle at bottom right, rgba(236, 72, 153, 0.05), transparent 55%),
                      rgba(255, 255, 255, 0.98);
          border-color: rgba(209, 213, 219, 0.9);
          box-shadow: 0 20px 40px rgba(148, 163, 184, 0.4);
        }

        .org-create-section::before,
        .org-events-section::before {
          content: '';
          position: absolute;
          inset: -40%;
          background: radial-gradient(circle at 10% 0%, rgba(59, 130, 246, 0.12), transparent 50%),
                      radial-gradient(circle at 90% 100%, rgba(236, 72, 153, 0.12), transparent 50%);
          opacity: 0.9;
          pointer-events: none;
        }

        .organizer-app.light .org-create-section::before,
        .organizer-app.light .org-events-section::before {
          opacity: 0.8;
        }

        .org-create-section > *,
        .org-events-section > * {
          position: relative;
          z-index: 1;
        }

        .org-create-section h2,
        .org-events-section h2 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .org-section-subtitle {
          font-size: 13px;
          opacity: 0.9;
          margin-bottom: 18px;
        }

        .org-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .org-form-row {
          display: flex;
          gap: 12px;
        }

        @media (max-width: 640px) {
          .org-form-row {
            flex-direction: column;
          }
        }

        .org-form-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .org-form-group label {
          font-size: 13px;
          opacity: 0.95;
        }

        .org-required {
          color: #f97316;
          font-size: 12px;
          margin-left: 3px;
        }

        .org-optional {
          font-size: 11px;
          opacity: 0.8;
          margin-left: 4px;
        }

        .org-form-group input,
        .org-form-group select {
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.9);
          color: inherit;
          font-size: 13px;
          outline: none;
          transition: all 0.15s;
        }

        .org-form-group input::placeholder {
          opacity: 0.7;
        }

        .org-form-group input:focus,
        .org-form-group select:focus {
          border-color: rgba(129, 140, 248, 0.9);
          box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.6);
          background: rgba(15, 23, 42, 0.95);
        }

        .organizer-app.light .org-form-group input,
        .organizer-app.light .org-form-group select {
          background: rgba(249, 250, 251, 0.95);
          border-color: rgba(209, 213, 219, 1);
        }

        .organizer-app.light .org-form-group input:focus,
        .organizer-app.light .org-form-group select:focus {
          border-color: rgba(59, 130, 246, 0.9);
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.6);
          background: #ffffff;
        }

        .org-helper-text {
          font-size: 11px;
          opacity: 0.8;
        }

        .org-form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 6px;
          flex-wrap: wrap;
        }

        .org-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          opacity: 0.9;
        }

        .org-badge {
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid transparent;
        }

        .org-badge.draft {
          background: rgba(148, 163, 184, 0.25);
          border-color: rgba(148, 163, 184, 0.5);
        }

        .org-badge.published {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.7);
        }

        .organizer-app.light .org-badge.draft {
          background: rgba(148, 163, 184, 0.15);
        }

        .organizer-app.light .org-badge.published {
          background: rgba(34, 197, 94, 0.15);
        }

        .org-primary-btn {
          padding: 9px 16px;
          border-radius: 999px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          border: none;
          color: #f9fafb;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 12px 30px rgba(59, 130, 246, 0.7);
          transition: all 0.2s;
        }

        .org-primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 40px rgba(59, 130, 246, 0.9);
        }

        .organizer-app.light .org-primary-btn {
          box-shadow: 0 12px 30px rgba(59, 130, 246, 0.6);
        }

        .org-secondary-btn,
        .org-danger-btn {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: transparent;
          color: inherit;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .org-secondary-btn:hover {
          background: rgba(15, 23, 42, 0.9);
          transform: translateY(-1px);
        }

        .organizer-app.light .org-secondary-btn:hover {
          background: rgba(229, 231, 235, 0.7);
        }

        .org-danger-btn {
          border-color: rgba(248, 113, 113, 0.8);
          color: #fecaca;
        }

        .organizer-app.light .org-danger-btn {
          color: #b91c1c;
        }

        .org-danger-btn:hover {
          background: rgba(127, 29, 29, 0.9);
        }

        .organizer-app.light .org-danger-btn:hover {
          background: rgba(254, 202, 202, 0.9);
        }

        .org-events-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .org-filters {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        @media (max-width: 640px) {
          .org-events-header {
            flex-direction: column;
          }

          .org-filters {
            align-items: stretch;
          }
        }

        .org-search input {
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.8);
          background: rgba(15, 23, 42, 0.9);
          color: inherit;
          font-size: 13px;
          width: 260px;
          outline: none;
          transition: all 0.15s;
        }

        .org-search input::placeholder {
          opacity: 0.7;
        }

        .org-search input:focus {
          border-color: rgba(59, 130, 246, 0.9);
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.6);
        }

        .organizer-app.light .org-search input {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(209, 213, 219, 1);
        }

        .organizer-app.light .org-search input:focus {
          border-color: rgba(59, 130, 246, 0.9);
        }

        .org-status-filters {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .org-filter-btn {
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: rgba(15, 23, 42, 0.75);
          font-size: 12px;
          cursor: pointer;
          color: inherit;
          opacity: 0.85;
          transition: all 0.15s;
        }

        .organizer-app.light .org-filter-btn {
          background: rgba(243, 244, 246, 0.9);
        }

        .org-filter-btn.active {
          border-color: rgba(129, 140, 248, 0.9);
          background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.6), rgba(96, 165, 250, 0.7));
          color: #f9fafb;
          opacity: 1;
        }

        .organizer-app.light .org-filter-btn.active {
          color: #f9fafb;
        }

        .org-events-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 420px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .org-events-list::-webkit-scrollbar {
          width: 6px;
        }

        .org-events-list::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 999px;
        }

        .org-events-list::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.8);
          border-radius: 999px;
        }

        .organizer-app.light .org-events-list::-webkit-scrollbar-track {
          background: rgba(229, 231, 235, 0.8);
        }

        .organizer-app.light .org-events-list::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.9);
        }

        .org-event-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.24), transparent 55%),
                      rgba(15, 23, 42, 0.9);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.7);
        }

        .org-event-card.draft {
          background: radial-gradient(circle at top left, rgba(148, 163, 184, 0.25), transparent 55%),
                      rgba(15, 23, 42, 0.9);
          border-style: dashed;
        }

        .organizer-app.light .org-event-card {
          background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 55%),
                      rgba(255, 255, 255, 0.98);
          box-shadow: 0 16px 32px rgba(148, 163, 184, 0.4);
        }

        .organizer-app.light .org-event-card.draft {
          background: radial-gradient(circle at top left, rgba(148, 163, 184, 0.15), transparent 55%),
                      rgba(249, 250, 251, 0.98);
        }

        .org-event-main h3 {
          font-size: 15px;
          margin-bottom: 4px;
        }

        .org-event-main p {
          font-size: 13px;
          opacity: 0.9;
        }

        .org-map-link {
          color: #60a5fa;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .organizer-app.light .org-map-link {
          color: #2563eb;
        }

        .org-event-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .org-status-badge {
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid transparent;
        }

        .org-status-badge.published {
          background: rgba(22, 163, 74, 0.2);
          border-color: rgba(22, 163, 74, 0.9);
          color: #bbf7d0;
        }

        .organizer-app.light .org-status-badge.published {
          color: #166534;
          background: rgba(220, 252, 231, 0.9);
        }

        .org-status-badge.draft {
          background: rgba(148, 163, 184, 0.25);
          border-color: rgba(148, 163, 184, 0.8);
        }

        .organizer-app.light .org-status-badge.draft {
          background: rgba(229, 231, 235, 0.9);
        }

        .org-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: rgba(15, 23, 42, 0.6);
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .org-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .org-action-btn.edit:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.6);
        }

        .org-action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.6);
        }

        .organizer-app.light .org-action-btn {
          background: #ffffff;
          border-color: #e5e7eb;
        }

        .organizer-app.light .org-action-btn:hover {
          box-shadow: 0 4px 14px rgba(148, 163, 184, 0.7);
        }

        /* Buton nou pentru toggle Draft / Publică */
        .org-toggle-status-btn {
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .org-toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.25), rgba(15, 23, 42, 0.95));
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.7);
          transition: all 0.18s ease-out;
          color: inherit;
        }

        .organizer-app.light .org-toggle-pill {
          background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), #ffffff);
          box-shadow: 0 6px 14px rgba(148, 163, 184, 0.5);
        }

        .org-toggle-status-btn .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
        }

        .org-toggle-status-btn.to-draft .dot {
          background: #f97316;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.25);
        }

        .org-toggle-status-btn.to-published .dot {
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.25);
        }

        .org-toggle-status-btn:hover .org-toggle-pill {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.9);
          border-color: rgba(129, 140, 248, 0.9);
        }

        .organizer-app.light .org-toggle-status-btn:hover .org-toggle-pill {
          box-shadow: 0 10px 22px rgba(148, 163, 184, 0.9);
        }

        .org-empty-state {
          border-radius: 16px;
          border: 1px dashed rgba(148, 163, 184, 0.6);
          padding: 26px 18px;
          text-align: center;
          background: rgba(15, 23, 42, 0.85);
        }

        .organizer-app.light .org-empty-state {
          background: rgba(249, 250, 251, 0.95);
        }

        .org-empty-icon {
          font-size: 26px;
          margin-bottom: 8px;
        }

        .org-empty-state h3 {
          font-size: 15px;
          margin-bottom: 4px;
        }

        .org-empty-state p {
          font-size: 13px;
          opacity: 0.9;
        }

        .org-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          backdrop-filter: blur(6px);
        }

        .org-modal {
          width: 100%;
          max-width: 420px;
          background: rgba(15, 23, 42, 0.98);
          border-radius: 18px;
          padding: 18px 18px 16px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.75);
        }

        .organizer-app.light .org-modal {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(209, 213, 219, 1);
          box-shadow: 0 20px 40px rgba(148, 163, 184, 0.8);
        }

        .org-modal h2 {
          font-size: 17px;
          margin-bottom: 12px;
        }

        .org-modal p {
          font-size: 13px;
          opacity: 0.9;
          margin-bottom: 14px;
        }

        .org-modal-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 14px;
        }

        .org-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `}</style>
      </div>
    </div>
  );
}

export default OrganizerDashboard;


