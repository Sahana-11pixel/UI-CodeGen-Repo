import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

async def verify_stats():
    load_dotenv(Path('.') / '.env')
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("MONGO_URL or DB_NAME not found in .env")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Simulate the pipeline in server.py
    pipeline = [
        {
            "$project": {
                "normalized_framework": {
                    "$switch": {
                        "branches": [
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["react", "react.js"] ] }, "then": "React" },
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["html/css", "html_css", "html"] ] }, "then": "HTML/CSS" },
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["vue", "vuejs", "vue.js"] ] }, "then": "Vue" },
                            { "case": { "$eq": [ { "$toLower": "$framework" }, "svelte" ] }, "then": "Svelte" },
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["next_js", "nextjs", "next.js"] ] }, "then": "Next.js" },
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["nuxt_js", "nuxtjs", "nuxt.js"] ] }, "then": "Nuxt.js" },
                            { "case": { "$eq": [ { "$toLower": "$framework" }, "tailwind" ] }, "then": "Tailwind" },
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["bootstrap", "bootstrap5"] ] }, "then": "Bootstrap" },
                            { "case": { "$in": [ { "$toLower": "$framework" }, ["vanilla_js", "vanillajs", "vanilla"] ] }, "then": "Vanilla JS" }
                        ],
                        "default": "$framework"
                    }
                }
            }
        },
        {
            "$match": {
                "normalized_framework": { "$ne": "angular" }
            }
        },
        {
            "$group": {
                "_id": "$normalized_framework",
                "count": { "$sum": 1 }
            }
        },
        { "$sort": { "count": -1 } }
    ]
    
    results = await db.projects.aggregate(pipeline).to_list(None)
    
    print("Verified Framework Stats:")
    found_angular = False
    react_count = 0
    for res in results:
        print(f"{res['_id']}: {res['count']}")
        if res['_id'].lower() == 'angular':
            found_angular = True
        if res['_id'] == 'React':
            react_count = res['count']
            
    if not found_angular:
        print("\nSUCCESS: 'angular' has been excluded.")
    else:
        print("\nFAILURE: 'angular' is still present.")
        
    if react_count == 39:
        print(f"SUCCESS: 'React' count is 39 (36 'react' + 3 'React').")
    else:
        print(f"FAILURE: 'React' count is {react_count}, expected 39.")

if __name__ == "__main__":
    asyncio.run(verify_stats())
