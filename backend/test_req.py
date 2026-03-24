import requests

res = requests.post("http://localhost:8000/analyze", json={
    "script_text": "INT. HOUSE - DAY\nJohn talks to Mary.",
    "enable_ai": False,
    "max_scenes_for_ai": 20
})
print("STATUS CODE:", res.status_code)
try:
    print(res.json())
except Exception as e:
    print(res.text)
