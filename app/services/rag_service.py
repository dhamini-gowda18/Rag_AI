from typing import Any

import httpx

from app.core.config import settings


class RAGService:
    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model

        print("=" * 60)

    def generate_answer(self, question: str, context: list[dict[str, Any]]) -> str:
        if not self.api_key:
            return "Gemini API key is not configured."

        prompt = (
            "You are a helpful assistant.\n"
            "Answer ONLY using the provided context.\n\n"
        )

        prompt += "Context:\n"

        for i, item in enumerate(context, start=1):
            prompt += f"{i}. {item.get('text', '')}\n"

        prompt += f"\nQuestion: {question}\nAnswer:"

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2
            }
        }

        try:
            response = httpx.post(
                url,
                json=payload,
                timeout=60.0
            )

            response.raise_for_status()

            data = response.json()

            if "candidates" not in data:
                raise Exception(f"Unexpected Gemini response:\n{data}")

            return data["candidates"][0]["content"]["parts"][0]["text"]

        except httpx.HTTPStatusError as e:
            print("HTTP ERROR")
            print(e.response.text)
            raise

        except Exception as e:
            print("ERROR:", str(e))
            raise