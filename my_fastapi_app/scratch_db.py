import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import json
import sys
import datetime

# Simplified JSON encoder for ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime.datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.autoinspect
    # Get the project from CLI or just fetch the most recent one
    project = await db.projects.find_one({}, sort=[('_id', -1)])
    if project:
        print("Latest Project ID:", str(project["_id"]))
        print(json.dumps(project.get("analyzed_images", []), cls=JSONEncoder, indent=2))
    else:
        print("No project found.")

if __name__ == "__main__":
    asyncio.run(main())
