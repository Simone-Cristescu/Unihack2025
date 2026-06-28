import os
import json
from datetime import datetime, timedelta, UTC
import pytz # Necesar pentru a gestiona fusurile orare (dacă dorești ora locală RO)

import jwt
from google import genai
from flask import Flask, request, jsonify, g
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from functools import wraps

# Încarcă variabilele din .env
load_dotenv()

# Setează fusul orar local pentru uz intern (ex: chatbot context)
# Păstrăm referința chiar dacă folosim datetime.now().strftime()
ROMANIA_TZ = pytz.timezone('Europe/Bucharest') 

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
bcrypt = Bcrypt(app)

# ----------------- CONECTARE MONGO -----------------

MONGO_URI = os.getenv("MONGO_URI")  # ex: mongodb+srv://...
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "begavibe")

if not MONGO_URI:
    raise RuntimeError("Nu ai setat MONGO_URI în .env")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

users_col = db["users"]
events_col = db["events"]
tickets_col = db["tickets"]
# ----------------- GEMINI CONFIG -----------------
try:
    # The client automatically uses the GEMINI_API_KEY environment variable 
    # which was loaded from your local .env file.
    gemini_client = genai.Client()
    print("✅ Gemini Client initialized successfully.")
except Exception as e:
    print(f"⚠️ Error initializing Gemini Client: {e}")
    # Set to None if initialization fails to prevent crashes later
    gemini_client = None


# ----------------- FUNCTII GEMINI INTERNE -----------------

def check_profanity_internal(text_to_check):
    """Funcție internă care apelează Gemini pentru a verifica profanitatea."""
    if not gemini_client:
        return {"hasProfanity": False, "reason": "Gemini service unavailable, skipped check."}

    prompt = (
        "Ești un sistem de moderare a conținutului, strict și imparțial. "
        "Analizează următorul text, care este un câmp dintr-un formular public. "
        "Verifică dacă textul conține limbaj vulgar, jigniri, amenințări sau conținut explicit. "
        "Răspunde DOAR cu un obiect JSON în formatul: "
        "{ \"hasProfanity\": boolean, \"reason\": string }"
        "Unde `hasProfanity` este `true` dacă textul este neadecvat și `false` în caz contrar. "
        "NU adăuga niciun alt text."
        f"\n\nTEXT DE ANALIZAT: \"{text_to_check}\""
    )
    
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        json_text = response.text.strip().replace("```json", "").replace("```", "")
        
        try:
            result = json.loads(json_text)
            if 'hasProfanity' in result and 'reason' in result:
                 return result
            else:
                 raise ValueError("Răspunsul JSON nu a avut structura așteptată.")

        except json.JSONDecodeError as json_e:
            print(f"Eroare de parsare JSON (Profanity Check): {json_e}")
            # Dacă API-ul eșuează, nu blocăm textul, dar înregistram eroarea
            return {"hasProfanity": False, "reason": "Eroare la procesarea răspunsului API."}

    except Exception as e:
        print(f"Gemini API Error (Profanity Check): {e}")
        # Dacă apelul API eșuează, nu blocăm textul, dar înregistram eroarea
        return {"hasProfanity": False, "reason": "Eroare la apelul Gemini API."}


# --- Simple chat endpoint that proxies to Google Generative AI (Gemini) ---
@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.get_json(silent=True) or {}
    user_prompt = data.get('prompt') or data.get('message') or ''
    
    if not user_prompt:
        return jsonify({'error': 'empty_prompt'}), 400

    if not gemini_client:
        return jsonify({'error': 'service_unavailable', 'message': 'Gemini Client nu a putut fi inițializat.'}), 503

    # Obține data și ora curentă locală
    current_time_str = datetime.now().strftime("%A, %d %B %Y, %H:%M EET") 
    
    # Creează un prompt de sistem care include contextul de timp
    system_context = f"Ești un asistent util și prietenos. Data și ora curentă în România (EET) este: {current_time_str}. Răspunde la întrebarea utilizatorului."
    
    # Combină contextul cu întrebarea utilizatorului
    full_prompt = f"{system_context}\n\nUtilizator: {user_prompt}"

    model_name = 'gemini-2.5-flash' 
    
    try:
        response = gemini_client.models.generate_content(
            model=model_name,
            contents=full_prompt, # Folosește promptul complet
        )

        reply_text = response.text

        return jsonify({'reply': reply_text}), 200
        
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return jsonify({'error': 'gemini_api_call_failed', 'details': str(e)}), 502
    
# ----------------- API FILTRU DE CONȚINUT (Gemini) -----------------

@app.route('/api/filter/profanity', methods=['POST'])
def api_filter_profanity():
    data = request.get_json(silent=True) or {}
    text_to_check = data.get('text') or ''

    if not text_to_check or not text_to_check.strip():
        return jsonify({
            "hasProfanity": False,
            "message": "Text gol. Considerat inofensiv."
        }), 200
        
    result = check_profanity_internal(text_to_check)
    return jsonify(result), 200
    
    
# ----------------- JWT CONFIG -----------------

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXP_DAYS = int(os.getenv("JWT_EXP_DAYS", "7"))


def get_user_role(user):
    """Returnează rolul utilizatorului ('user' sau 'organizer')."""
    return user.get("role") or "user"


def create_jwt_token(user):
    role = get_user_role(user)
    payload = {
        "user_id": str(user["_id"]),
        "email": user["email"],
        "role": role,
        # CORECTAT: Folosește datetime.now(UTC)
        "exp": datetime.now(UTC) + timedelta(days=JWT_EXP_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token):
    # PyJWT decode necesită algoritmi în listă
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Lipseste token-ul de autentificare"}), 401

        token = auth_header.split(" ", 1)[1].strip()

        try:
            payload = decode_jwt_token(token) 
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirat"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token invalid"}), 401
        except Exception as e:
            print(f"Eroare la decodare JWT: {e}")
            return jsonify({"error": "Token invalid sau corupt"}), 401

        user_id = payload.get("user_id")
        if not user_id:
            return jsonify({"error": "Token fara utilizator"}), 401

        try:
            user_obj_id = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Token invalid"}), 401

        user = users_col.find_one({"_id": user_obj_id})
        if not user:
            return jsonify({"error": "Utilizator inexistent"}), 401

        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


# ----------------- UTILS -----------------


def event_to_json(e):
    """Transformă un document de eveniment într-un dict JSON serializabil."""
    return {
        "id": str(e["_id"]),
        "title": e.get("title"),
        "date": e.get("date"),
        "locationName": e.get("locationName"),
        "latitude": e.get("latitude"),
        "longitude": e.get("longitude"),
        "imageUrl": e.get("imageUrl"),
        "category": e.get("category"),
        "price": e.get("price"),
        "minAge": e.get("minAge"),
        "status": e.get("status"),
        "ownerId": str(e["ownerId"]) if e.get("ownerId") else None,
    }


# ----------------- SEED EVENTS -----------------


def seed_events_if_empty():
    if events_col.count_documents({}) == 0:
        sample_events = [
            {
                "title": "Concert Rock în Timișoara",
                "date": "2025-11-20",
                "locationName": "Sala Capitol",
                "latitude": 45.7542,
                "longitude": 21.2272,
                "imageUrl": "https://via.placeholder.com/300x150?text=Concert",
                "status": "published",
                "createdAt": datetime.now(UTC), # CORECTAT
            },
            {
                "title": "Festival de teatru",
                "date": "2025-11-22",
                "locationName": "Teatrul Național Timișoara",
                "latitude": 45.7549,
                "longitude": 21.2257,
                "imageUrl": "https://via.placeholder.com/300x150?text=Teatru",
                "status": "published",
                "createdAt": datetime.now(UTC), # CORECTAT
            },
            {
                "title": "Târg de Crăciun",
                "date": "2025-12-01",
                "locationName": "Piața Victoriei",
                "latitude": 45.7537,
                "longitude": 21.2253,
                "imageUrl": "https://via.placeholder.com/300x150?text=Targ+de+Craciun",
                "status": "published",
                "createdAt": datetime.now(UTC), # CORECTAT
            },
        ]
        events_col.insert_many(sample_events)


@app.before_request
def init_db():
    users_col.create_index("email", unique=True)
    seed_events_if_empty()


# ----------------- API AUTH -----------------


@app.post("/api/register")
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email si parola necesare"}), 400

    if users_col.find_one({"email": email}):
        return jsonify({"error": "Email deja folosit"}), 400

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    result = users_col.insert_one(
        {
            "email": email,
            "passwordHash": password_hash,
            "role": "user",
            "createdAt": datetime.now(UTC), # CORECTAT
        }
    )

    user = users_col.find_one({"_id": result.inserted_id})
    token = create_jwt_token(user)

    return jsonify({"message": "Cont creat cu succes", "token": token}), 201


@app.post("/api/login")
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email si parola necesare"}), 400

    user = users_col.find_one({"email": email})
    if not user:
        return jsonify({"error": "Email sau parola gresite"}), 401

    if not bcrypt.check_password_hash(user["passwordHash"], password):
        return jsonify({"error": "Email sau parola gresite"}), 401

    token = create_jwt_token(user)

    return jsonify({"message": "Autentificare reusita", "token": token}), 200


@app.get("/api/me")
@jwt_required
def get_me():
    user = g.current_user
    role = get_user_role(user)
    return (
        jsonify(
            {
                "id": str(user["_id"]),
                "email": user.get("email"),
                "role": role,
                "createdAt": user.get("createdAt").isoformat()
                if isinstance(user.get("createdAt"), datetime)
                else None,
            }
        ),
        200,
    )


@app.patch("/api/me")
@jwt_required
def update_me():
    """
    Actualizează datele de bază ale utilizatorului curent (email, parolă).
    Body JSON acceptat (toate câmpurile opționale):
      - email: string
      - password: string (noua parolă)
    """
    user = g.current_user
    data = request.get_json() or {}

    updates = {}
    email = data.get("email")
    password = data.get("password")

    if email is not None:
        new_email = (email or "").strip().lower()
        if not new_email:
            return jsonify({"error": "Email-ul nu poate fi gol"}), 400

        if new_email != user.get("email"):
            if users_col.find_one({"email": new_email}):
                return jsonify({"error": "Email deja folosit"}), 400
        updates["email"] = new_email

    if password is not None:
        if not password:
            return jsonify({"error": "Parola nu poate fi goală"}), 400
        password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
        updates["passwordHash"] = password_hash

    if not updates:
        return jsonify({"error": "Nimic de actualizat"}), 400

    users_col.update_one({"_id": user["_id"]}, {"$set": updates})
    updated_user = users_col.find_one({"_id": user["_id"]})

    # dacă s-a schimbat email-ul sau parola, generăm un nou token
    new_token = create_jwt_token(updated_user)
    role = get_user_role(updated_user)

    return (
        jsonify(
            {
                "message": "Profil actualizat cu succes",
                "token": new_token,
                "user": {
                    "id": str(updated_user["_id"]),
                    "email": updated_user.get("email"),
                    "role": role,
                    "createdAt": updated_user.get("createdAt").isoformat()
                    if isinstance(updated_user.get("createdAt"), datetime)
                    else None,
                },
            }
        ),
        200,
    )


@app.post("/api/organizers/register")
def register_organizer():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    org_name = (data.get("orgName") or "").strip()
    phone = (data.get("phone") or "").strip()
    website = (data.get("website") or "").strip()
    description = (data.get("description") or "").strip()

    if not email or not password or not org_name:
        return jsonify({"error": "Email, parola si numele organizatorului sunt necesare"}), 400

    if users_col.find_one({"email": email}):
        return jsonify({"error": "Email deja folosit"}), 400

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    organizer_profile = {
        "name": org_name,
        "phone": phone or None,
        "website": website or None,
        "description": description or None,
        "createdAt": datetime.now(UTC), # CORECTAT
    }

    result = users_col.insert_one(
        {
            "email": email,
            "passwordHash": password_hash,
            "role": "organizer",
            "organizerProfile": organizer_profile,
            "createdAt": datetime.now(UTC), # CORECTAT
        }
    )

    user = users_col.find_one({"_id": result.inserted_id})
    token = create_jwt_token(user)

    return jsonify({"message": "Cont organizator creat cu succes", "token": token}), 201


@app.get("/api/organizers/me")
@jwt_required
def get_organizer_me():
    user = g.current_user
    if get_user_role(user) != "organizer":
        return jsonify({"error": "Doar organizatorii au acces la acest endpoint"}), 403

    profile = user.get("organizerProfile") or {}
    profile_out = dict(profile)
    created_at = profile_out.get("createdAt")
    if isinstance(created_at, datetime):
        profile_out["createdAt"] = created_at.isoformat()

    return (
        jsonify(
            {
                "id": str(user["_id"]),
                "email": user.get("email"),
                "role": "organizer",
                "organizerProfile": profile_out,
            }
        ),
        200,
    )


@app.patch("/api/organizers/me")
@jwt_required
def update_organizer_me():
    """
    Actualizează profilul de organizator al utilizatorului curent.
    Body JSON acceptat (toate câmpurile opționale):
      - orgName: string
      - phone: string
      - website: string
      - description: string
    """
    user = g.current_user
    if get_user_role(user) != "organizer":
        return jsonify({"error": "Doar organizatorii au acces la acest endpoint"}), 403

    data = request.get_json() or {}

    org_name = data.get("orgName")
    phone = data.get("phone")
    website = data.get("website")
    description = data.get("description")

    profile = dict(user.get("organizerProfile") or {})

    if org_name is not None:
        name_clean = (org_name or "").strip()
        if not name_clean:
            return jsonify({"error": "Numele organizatorului nu poate fi gol"}), 400
        profile["name"] = name_clean

    if phone is not None:
        profile["phone"] = (phone or "").strip() or None

    if website is not None:
        profile["website"] = (website or "").strip() or None

    if description is not None:
        profile["description"] = (description or "").strip() or None

    profile["updatedAt"] = datetime.now(UTC) # CORECTAT

    users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"organizerProfile": profile}},
    )

    # refacem user-ul pentru răspuns consecvent
    updated = users_col.find_one({"_id": user["_id"]})
    profile_out = dict(updated.get("organizerProfile") or {})
    created_at = profile_out.get("createdAt")
    if isinstance(created_at, datetime):
        profile_out["createdAt"] = created_at.isoformat()
    updated_at = profile_out.get("updatedAt")
    if isinstance(updated_at, datetime):
        profile_out["updatedAt"] = updated_at.isoformat()

    return (
        jsonify(
            {
                "message": "Profil organizator actualizat cu succes",
                "id": str(updated["_id"]),
                "email": updated.get("email"),
                "role": "organizer",
                "organizerProfile": profile_out,
            }
        ),
        200,
    )


# ----------------- API EVENIMENTE -----------------


@app.get("/api/events")
def get_events():
    docs = list(events_col.find({}))
    result = [event_to_json(e) for e in docs]
    return jsonify(result), 200


@app.get("/api/events/<event_id>")
def get_event(event_id):
    try:
        obj_id = ObjectId(event_id)
    except Exception:
        return jsonify({"error": "ID eveniment invalid"}), 400

    event = events_col.find_one({"_id": obj_id})
    if not event:
        return jsonify({"error": "Eveniment inexistent"}), 404

    return jsonify(event_to_json(event)), 200


@app.post("/api/events")
def create_event():
    # NU ESTE PROTEJAT DE JWT, lăsat așa cum era original, deși ar trebui protejat.
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    date = (data.get("date") or "").strip()
    location_name = (data.get("locationName") or "").strip()

    if not title or not date or not location_name:
        return (
            jsonify(
                {
                    "error": "Campurile 'title', 'date' si 'locationName' sunt obligatorii",
                }
            ),
            400,
        )

    event_doc = {
        "title": title,
        "date": date,
        "locationName": location_name,
        "imageUrl": data.get("imageUrl"),
        "category": data.get("category"),
        "price": data.get("price"),
        "minAge": data.get("minAge"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "status": data.get("status") or "published",
        "createdAt": datetime.now(UTC), # CORECTAT
    }

    result = events_col.insert_one(event_doc)
    event_doc["_id"] = result.inserted_id

    return jsonify(event_to_json(event_doc)), 201


@app.get("/api/organizers/me/events")
@jwt_required
def get_my_events():
    user = g.current_user
    if get_user_role(user) != "organizer":
        return jsonify({"error": "Doar organizatorii au acces la acest endpoint"}), 403

    docs = list(events_col.find({"ownerId": user["_id"]}))
    result = [event_to_json(e) for e in docs]
    return jsonify(result), 200


@app.post("/api/organizers/me/events")
@jwt_required
def create_my_event():
    user = g.current_user
    if get_user_role(user) != "organizer":
        return jsonify({"error": "Doar organizatorii pot crea evenimente"}), 403

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    date = (data.get("date") or "").strip()
    location_name = (data.get("locationName") or "").strip()
    description = (data.get("description") or "").strip() # Adăugat description pentru verificare

    if not title or not date or not location_name:
        return (
            jsonify(
                {
                    "error": "Campurile 'title', 'date' si 'locationName' sunt obligatorii",
                }
            ),
            400,
        )

    # NOUA LOGICĂ DE BLOCARE AICI
    # Combinăm titlul și descrierea pentru o verificare completă
    full_text_check = f"Titlu: {title}. Descriere: {description}" 
    
    profanity_check_result = check_profanity_internal(full_text_check)
    
    if profanity_check_result.get("hasProfanity"):
        # BLOCKARE & ALERTĂ
        return (
            jsonify(
                {
                    "error": "Conținutul evenimentului (Titlu/Descriere) conține limbaj neadecvat.",
                    "reason": profanity_check_result.get("reason", "Motiv nespecificat de filtru."),
                    "alert": "Te rugăm să corectezi textul înainte de a trimite." # Mesaj pentru frontend
                }
            ),
            400, # Bad Request
        )
    # SFÂRȘIT LOGICĂ BLOCARE
    
    event_doc = {
        "title": title,
        "date": date,
        "locationName": location_name,
        "imageUrl": data.get("imageUrl"),
        "category": data.get("category"),
        "price": data.get("price"),
        "minAge": data.get("minAge"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "status": data.get("status") or "draft",
        "ownerId": user["_id"],
        "createdAt": datetime.now(UTC), # CORECTAT
    }

    result = events_col.insert_one(event_doc)
    event_doc["_id"] = result.inserted_id

    return jsonify(event_to_json(event_doc)), 201


@app.patch("/api/events/<event_id>")
@jwt_required
def update_event(event_id):
    user = g.current_user
    if get_user_role(user) != "organizer":
        return jsonify({"error": "Doar organizatorii pot modifica evenimente"}), 403

    try:
        obj_id = ObjectId(event_id)
    except Exception:
        return jsonify({"error": "ID eveniment invalid"}), 400

    event = events_col.find_one({"_id": obj_id})
    if not event:
        return jsonify({"error": "Eveniment inexistent"}), 404

    owner_id = event.get("ownerId")
    if owner_id is not None and owner_id != user["_id"]:
        return jsonify({"error": "Nu ai permisiunea sa modifici acest eveniment"}), 403

    data = request.get_json() or {}

    allowed_fields = [
        "title",
        "date",
        "locationName",
        "imageUrl",
        "category",
        "price",
        "minAge",
        "status",
        "latitude",
        "longitude",
    ]

    update_fields = {}
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]

    if not update_fields:
        return jsonify({"error": "Nimic de actualizat"}), 400
        
    # Dacă se modifică titlul sau alte câmpuri text, se poate adăuga o verificare de profanitate aici
    # (similar cu logica din create_my_event, dar este lăsată ca îmbunătățire opțională)

    update_fields["updatedAt"] = datetime.now(UTC) # Adăugat un timestamp de actualizare

    events_col.update_one({"_id": obj_id}, {"$set": update_fields})
    updated = events_col.find_one({"_id": obj_id})

    return jsonify(event_to_json(updated)), 200


@app.delete("/api/events/<event_id>")
@jwt_required
def delete_event(event_id):
    user = g.current_user
    if get_user_role(user) != "organizer":
        return jsonify({"error": "Doar organizatorii pot sterge evenimente"}), 403

    try:
        obj_id = ObjectId(event_id)
    except Exception:
        return jsonify({"error": "ID eveniment invalid"}), 400

    event = events_col.find_one({"_id": obj_id})
    if not event:
        return jsonify({"error": "Eveniment inexistent"}), 404

    owner_id = event.get("ownerId")
    if owner_id is not None and owner_id != user["_id"]:
        return jsonify({"error": "Nu ai permisiunea sa stergi acest eveniment"}), 403

    events_col.delete_one({"_id": obj_id})
    return jsonify({"message": "Eveniment sters"}), 200


# ----------------- API BILETE -----------------


@app.post("/api/tickets")
@jwt_required
def create_ticket():
    user = g.current_user
    data = request.get_json() or {}

    event_id = (data.get("eventId") or "").strip()
    count_raw = data.get("count", 1)

    try:
        event_obj_id = ObjectId(event_id)
    except Exception:
        return jsonify({"error": "ID eveniment invalid"}), 400

    event = events_col.find_one({"_id": event_obj_id})
    if not event:
        return jsonify({"error": "Eveniment inexistent"}), 404

    try:
        count = int(count_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "Count invalid"}), 400

    if count <= 0:
        return jsonify({"error": "Count trebuie sa fie pozitiv"}), 400

    ticket_doc = {
        "userId": user["_id"],
        "eventId": event_obj_id,
        "count": count,
        "createdAt": datetime.now(UTC), # CORECTAT
    }

    result = tickets_col.insert_one(ticket_doc)
    ticket_doc["_id"] = result.inserted_id

    return (
        jsonify(
            {
                "id": str(ticket_doc["_id"]),
                "eventId": str(ticket_doc["eventId"]),
                "count": ticket_doc["count"],
                "createdAt": ticket_doc["createdAt"].isoformat(),
            }
        ),
        201,
    )


@app.get("/api/my-tickets")
@jwt_required
def get_my_tickets():
    user = g.current_user
    user_id = user["_id"]

    tickets = list(tickets_col.find({"userId": user_id}))
    event_ids = {t["eventId"] for t in tickets if t.get("eventId")}

    events_map = {}
    if event_ids:
        events = events_col.find({"_id": {"$in": list(event_ids)}})
        for e in events:
            events_map[e["_id"]] = e

    result = []
    for t in tickets:
        ev = events_map.get(t.get("eventId"))
        created_at = t.get("createdAt")
        result.append(
            {
                "id": str(t["_id"]),
                "eventId": str(t["eventId"]) if t.get("eventId") else None,
                "count": t.get("count"),
                "createdAt": created_at.isoformat()
                if isinstance(created_at, datetime)
                else None,
                "eventTitle": ev.get("title") if ev else None,
                "eventDate": ev.get("date") if ev else None,
                "eventLocationName": ev.get("locationName") if ev else None,
            }
        )

    return jsonify(result), 200


if __name__ == "__main__":
    # Rulăm Flask, default pe 127.0.0.1:5000
    app.run(debug=True)