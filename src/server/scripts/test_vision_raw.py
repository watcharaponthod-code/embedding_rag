
import requests
import base64
import json
import time

# --- CONFIG ---
OLLAMA_HOST = "http://10.0.2.191:11434"
MODEL_NAME = "qwen3-vl:2b"
IMAGE_PATH = "server/scripts/Screenshot 2026-01-08 095524.png"

try:
    with open(IMAGE_PATH, "rb") as image_file:
        base64_img = base64.b64encode(image_file.read()).decode('utf-8')
    print(f"Loaded image from {IMAGE_PATH} (Length: {len(base64_img)})")
except FileNotFoundError:
    print(f"Error: Image file not found at {IMAGE_PATH}")
    # Fallback to white pixel if file missing (just to not crash script)
    base64_img = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RCYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=="

print(f"--- TESTING VISION MODEL: {MODEL_NAME} ---")
print(f"Target Host: {OLLAMA_HOST}")
print("Payload: Specific Test Image")

payload = {
    "model": MODEL_NAME,
    "prompt": "describe this image briefly",
    "images": [base64_img],
    "stream": False,
    "options": {
        "temperature": 0.1
    }
}

try:
    start_time = time.time()
    print("Sending Request... (This might take time if model is loading)")
    
    response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=600)
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\n--- RESPONSE (Time: {duration:.2f}s) ---")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("SUCCESS! Model output:")
        print("-" * 30)
        print(data.get("response", "NO RESPONSE FIELD FOUND"))
        print("-" * 30)
    else:
        print("FAILURE! Raw Response:")
        print(response.text)

except Exception as e:
    print(f"\nCRITICAL ERROR: {str(e)}")
