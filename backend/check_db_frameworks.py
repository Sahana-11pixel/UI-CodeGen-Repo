import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

async def check_frameworks():
    load_dotenv(Path('.') / '.env')
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("MONGO_URL or DB_NAME not found in .env")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    pipeline = [
        {"$group": {"_id": "$framework", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.projects.aggregate(pipeline).to_list(None)
    print("Framework Counts in Database:")
    total = 0
    for res in results:
        print(f"'{res['_id']}': {res['count']}")
        total += res['count']
    print(f"Total Projects: {total}")

if __name__ == "__main__":
    asyncio.run(check_frameworks())
