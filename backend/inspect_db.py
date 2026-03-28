import motor.motor_asyncio
import asyncio

async def inspect_projects():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    projects = await db.projects.find().to_list(100)
    print(f"Inspecting {len(projects)} projects...")
    
    required_fields = ["id", "user_id", "title", "framework", "created_at"]
    
    for i, p in enumerate(projects):
        missing = [f for f in required_fields if f not in p]
        if missing:
            print(f"Project {i} ({p.get('id', 'N/A')}): Missing {missing}")
        if p.get('updated_at') is None:
            # print(f"Project {i} ({p.get('id', 'N/A')}): missing updated_at")
            pass

    # Check for owner_email join issue
    pipeline = [
        {"$lookup": {"from": "users", "localField": "user_id", "foreignField": "id", "as": "owner"}},
        {"$unwind": {"path": "$owner", "preserveNullAndEmptyArrays": True}},
        {"$project": {"id": 1, "owner_email": "$owner.email"}}
    ]
    results = await db.projects.aggregate(pipeline).to_list(100)
    for r in results:
        if r.get('owner_email') is None:
            print(f"Project {r.get('id')} has NO OWNER Email")

if __name__ == "__main__":
    asyncio.run(inspect_projects())
