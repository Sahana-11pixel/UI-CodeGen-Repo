import requests
import jwt
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def verify_project_details():
    JWT_SECRET = os.getenv("JWT_SECRET")
    if not JWT_SECRET:
        print("JWT_SECRET not found in .env")
        return

    # Create admin token
    payload = {
        "user_id": "admin",
        "email": "admin@example.com",
        "role": "admin",
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get a project ID
    r = requests.get("http://localhost:8000/api/admin/projects", headers=headers, timeout=10)
    if r.status_code != 200:
        print(f"Failed to fetch projects: {r.status_code}")
        print(r.text)
        return

    projects = r.json().get("projects", [])
    if not projects:
        print("No projects found to test.")
        return

    project_id = projects[0]["id"]
    print(f"Testing with Project ID: {project_id}")

    # 2. Get details
    r_details = requests.get(f"http://localhost:8000/api/admin/projects/{project_id}", headers=headers, timeout=5)
    print(f"Details Status: {r_details.status_code}")
    if r_details.status_code == 200:
        details = r_details.json()
        print(f"Title: {details.get('title')}")
        print(f"Owner Email: {details.get('owner_email')}")
        print(f"Framework: {details.get('framework')}")
        print("SUCCESS: Project details retrieved.")
    else:
        print(f"FAILURE: {r_details.text}")

if __name__ == "__main__":
    verify_project_details()
