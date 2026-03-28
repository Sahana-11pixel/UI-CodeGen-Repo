import motor.motor_asyncio
import asyncio
import os
import jwt
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "9a9bfe9a41f4bc99d7df5c54c675ae27297719a0eba03b593e95dfbe996cca7e")
JWT_ALGORITHM = 'HS256'

def create_jwt_token(user_id: str, email: str, role: str):
    expiration = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def reproduce_sorting_issue():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        print("No admin found.")
        return

    token = create_jwt_token(admin["id"], admin["email"], admin["role"])
    headers = {"Authorization": f"Bearer {token}"}
    
    test_cases = [
        {"sortBy": "name", "order": "desc"},
        {"sortBy": "name", "order": "asc"}, # Second click
        {"sortBy": "ownerEmail", "order": "desc"},
        {"sortBy": "ownerEmail", "order": "asc"}, # Second click
        {"sortBy": "createdAt", "order": "desc"},
        {"sortBy": "createdAt", "order": "asc"}, # Second click
    ]

    for i, case in enumerate(test_cases):
        url = f"http://localhost:8000/api/admin/projects?sortBy={case['sortBy']}&order={case['order']}&limit=5"
        print(f"\nStep {i+1}: Calling {url}")
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            print(f"SUCCESS: Received {len(r.json()['projects'])} projects")
        else:
            print(f"FAILURE: Status {r.status_code}")
            print(f"Error detail: {r.text}")

if __name__ == "__main__":
    asyncio.run(reproduce_sorting_issue())
