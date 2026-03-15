import asyncio
from main import estimate_prices

async def test_estimation():
    payload = {
        "damages": ["damaged bumper", "dent", "damaged headlight"],
        "make": "Honda",
        "model": "Civic",
        "year": "2020"
    }
    print("Testing payload:", payload)
    result = await estimate_prices(payload)
    print("Result:", result)

if __name__ == "__main__":
    asyncio.run(test_estimation())
