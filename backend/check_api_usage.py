import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

async def check_api_usage():
    load_dotenv(Path('.') / '.env')
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("MONGO_URL or DB_NAME not found in .env")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    count = await db.api_usage.count_documents({})
    print(f"Total API Calls in Database: {count}")
    
    # Framework distribution in api_usage
    pipeline = [
        {"$group": {"_id": "$framework", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    results = await db.api_usage.aggregate(pipeline).to_list(None)
    print("\nAPI Usage by Framework:")
    for res in results:
        print(f"{res['_id']}: {res['count']}")

if __name__ == "__main__":
    asyncio.run(check_api_usage())
