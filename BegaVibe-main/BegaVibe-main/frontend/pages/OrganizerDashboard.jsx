// src/pages/OrganizerDashboard.jsx
import React, { useEffect, useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:5000';

const mapApiEventToUi = (apiEv) => ({
  id: apiEv.id,
  title: apiEv.title || '',
  date: apiEv.date || '',
  locationName: apiEv.locationName || '',
  price: apiEv.price || '',
  status: apiEv.status || 'draft',
});

function OrganizerDashboard({ theme, onToggleTheme, onLogout, authToken, currentUser }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    date: '',
    locationName: '',
    price: '',
    status: 'draft',
  });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      if (!authToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
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
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data.map(mapApiEventToUi) : []);
        }
      } catch (err) {
        console.warn('Nu s-au putut incarca evenimentele organizatorului.', err);
        if (!cancelled) {
          setError('Nu s-au putut incarca evenimentele. Incearca din nou mai tarziu.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      title: '',
      date: '',
      locationName: '',
      price: '',
      status: 'draft',
    });
    setEditingId(null);
  };

  const validateForm = () => {
    if (!form.title.trim() || !form.date.trim() || !form.locationName.trim()) {
      alert("Campurile 'titlu', 'data' si 'locatie' sunt obligatorii.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authToken) {
      alert('Trebuie sa fii autentificat ca organizator pentru a gestiona evenimente.');
      return;
    }
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        date: form.date.trim(),
        locationName: form.locationName.trim(),
        price: form.price.trim() || 'Gratuit',
        status: form.status || 'draft',
      };

      if (!editingId) {
        // create
        const res = await fetch(`${API_BASE_URL}/api/organizers/me/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || data.message || `Eroare ${res.status}`);
        }
        const created = mapApiEventToUi(data);
        setEvents((prev) => [created, ...prev]);
        resetForm();
        alert('Eveniment creat cu succes.');
      } else {
        // update
        const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || data.message || `Eroare ${res.status}`);
        }
        const updated = mapApiEventToUi(data);
        setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
        resetForm();
        alert('Eveniment actualizat cu succes.');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'A aparut o eroare la salvarea evenimentului.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (ev) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title || '',
      date: ev.date || '',
      locationName: ev.locationName || '',
      price: ev.price || '',
      status: ev.status || 'draft',
    });
  };

  const handleDelete = async (id) => {
    if (!authToken) {
      alert('Trebuie sa fii autentificat ca organizator pentru a sterge evenimente.');
      return;
    }
    if (!window.confirm('Sigur vrei sa stergi acest eveniment?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `Eroare ${res.status}`);
      }
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      alert('Eveniment sters cu succes.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'A aparut o eroare la stergerea evenimentului.');
    }
  };

  const handleToggleStatus = async (ev) => {
    if (!authToken) {
      alert('Trebuie sa fii autentificat ca organizator pentru a modifica statusul.');
      return;
    }
    const newStatus = ev.status === 'published' ? 'draft' : 'published';

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(ev.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `Eroare ${res.status}`);
      }
      const updated = mapApiEventToUi(data);
      setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      console.error(err);
      alert(err.message || 'A aparut o eroare la modificarea statusului.');
    }
  };

  const containerClass = theme === 'light' ? 'organizer-dashboard light' : 'organizer-dashboard';

  return (
    <div className={containerClass}>
      <header className="org-header-bar">
        <div>
          <h1>Organizer Dashboard</h1>
          <p>Gestioneaza-ti evenimentele direct din BegaVibe.</p>
        </div>
        <div className="org-header-actions">
          <button type="button" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {!authToken && (
        <p style={{ marginTop: 16 }}>
          Nu exista token de autentificare. Te rugam sa te loghezi ca organizator.
        </p>
      )}

      {error && (
        <p style={{ marginTop: 16, color: '#f87171' }}>
          {error}
        </p>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>{editingId ? 'Editeaza eveniment' : 'Creeaza eveniment nou'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <input
            name="title"
            placeholder="Titlu*"
            value={form.title}
            onChange={handleChange}
          />
          <input
            name="date"
            placeholder="Data (YYYY-MM-DD)*"
            value={form.date}
            onChange={handleChange}
          />
          <input
            name="locationName"
            placeholder="Locatie*"
            value={form.locationName}
            onChange={handleChange}
          />
          <input
            name="price"
            placeholder="Pret (ex: Gratuit / 50 RON)"
            value={form.price}
            onChange={handleChange}
          />
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
          <button type="submit" disabled={submitting}>
            {editingId ? 'Salveaza' : 'Creeaza'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} disabled={submitting}>
              Renunta
            </button>
          )}
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Evenimentele tale</h2>
        {loading ? (
          <p>Se incarca evenimentele...</p>
        ) : events.length === 0 ? (
          <p>Nu ai inca niciun eveniment.</p>
        ) : (
          <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Titlu</th>
                <th>Data</th>
                <th>Locatie</th>
                <th>Pret</th>
                <th>Status</th>
                <th>Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.title}</td>
                  <td>{ev.date}</td>
                  <td>{ev.locationName}</td>
                  <td>{ev.price}</td>
                  <td>{ev.status}</td>
                  <td>
                    <button type="button" onClick={() => handleEditClick(ev)}>
                      Editeaza
                    </button>
                    <button type="button" onClick={() => handleToggleStatus(ev)}>
                      {ev.status === 'published' ? 'Treci in draft' : 'Publica'}
                    </button>
                    <button type="button" onClick={() => handleDelete(ev.id)}>
                      Sterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default OrganizerDashboard;

