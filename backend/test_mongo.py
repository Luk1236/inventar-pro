import motor.motor_asyncio
import asyncio
import os

async def test():
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    print(f"Connecting to {mongo_url}...")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    try:
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
