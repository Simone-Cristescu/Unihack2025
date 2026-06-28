from pprint import pprint

from api import app  # backend/api.py


def main() -> None:
    client = app.test_client()

    print("--- Testing organizer registration ---")
    resp = client.post(
        "/api/organizers/register",
        json={
            "email": "debug_organizer@example.com",
            "password": "TestPassword123!",
            "orgName": "Debug Org",
        },
    )
    print("status", resp.status_code)
    data = resp.get_json()
    pprint(data)

    if not resp.ok or "token" not in (data or {}):
        print("Organizer registration failed; aborting.")
        return

    token = data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Testing GET /api/organizers/me ---")
    resp_me = client.get("/api/organizers/me", headers=headers)
    print("status", resp_me.status_code)
    pprint(resp_me.get_json())

    print("\n--- Testing POST /api/organizers/me/events ---")
    resp_ev = client.post(
        "/api/organizers/me/events",
        headers=headers,
        json={
            "title": "Debug Event From Script",
            "date": "2025-12-31",
            "locationName": "Some venue, Timisoara",
            "price": "50 RON",
            "status": "draft",
        },
    )
    print("status", resp_ev.status_code)
    pprint(resp_ev.get_json())

    print("\n--- Testing GET /api/organizers/me/events ---")
    resp_ev_list = client.get("/api/organizers/me/events", headers=headers)
    print("status", resp_ev_list.status_code)
    pprint(resp_ev_list.get_json())


if __name__ == "__main__":
    main()

