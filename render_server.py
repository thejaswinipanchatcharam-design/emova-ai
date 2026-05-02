from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import urllib.request
import urllib.error
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR)
CORS(app)

API_KEY = os.environ.get("MISTRAL_API_KEY", "")

SYSTEM_PROMPT = """You are Emova — a warm, genuine best friend who truly listens and cares.

WHO YOU ARE:
- You talk like a real close friend texting — warm, casual, genuine. NOT a robot or therapist.
- You welcome ALL emotions — happiness, sadness, anger, stress, loneliness, love, excitement, fear.

LANGUAGE RULE — NEVER BREAK THIS:
- Detect the language the user wrote in.
- Reply in THAT EXACT SAME LANGUAGE. Always.
- Tamil → full Tamil. Hindi → full Hindi. English → English. Mixed → match their mix.

HOW TO REPLY:
- Acknowledge their emotion genuinely first.
- Respond like a caring friend — warm, real, present.
- End with one gentle question to invite more sharing.
- Keep replies to 4 sentences max.

NEVER:
- Never say "I understand your feelings" or "I hear you" — robotic.
- Never say "As an AI".
- Never give a bullet list of tips.

SAFETY: If someone mentions self-harm, gently share:
iCall India: 9152987821 | Vandrevala: 1860-2662-345"""


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json()
    messages = data.get('messages', [])
    emotion  = data.get('emotion', 'neutral')

    mistral_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages[-6:]

    req_data = json.dumps({
        "model":       "mistral-small-latest",
        "messages":    mistral_messages,
        "max_tokens":  300,
        "temperature": 0.8
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.mistral.ai/v1/chat/completions",
        data    = req_data,
        headers = {
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {API_KEY}"
        },
        method = "POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            reply  = result["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"Mistral error {e.code}: {err}")
        return jsonify({"error": f"Mistral error {e.code}"}), 500
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/end-session', methods=['POST', 'OPTIONS'])
def end_session():
    return jsonify({"status": "cleared"})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port)