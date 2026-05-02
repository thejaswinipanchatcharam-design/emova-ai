import json
import http.server
import urllib.request
import urllib.error
import sys
import os

# ══════════════════════════════════════════════
#   PASTE YOUR MISTRAL KEY BELOW
#   Get it free from: console.mistral.ai
# ══════════════════════════════════════════════
API_KEY = "4OQBh7IMClbG9SWxUh8KKYB2lE88vB3U"
PORT    = 3000
# ══════════════════════════════════════════════

# Server-side session log (only for terminal display)
session_log = []

SYSTEM_PROMPT = """You are Aura — a warm, genuine best friend who truly listens and cares deeply.

WHO YOU ARE:
- You are like that one friend everyone wishes they had — listens without judging, says the right thing, makes people feel truly understood.
- You are NOT a robot, NOT a therapist. You talk like a real human best friend texting someone they care about.
- You welcome ALL emotions — happiness, sadness, anger, stress, loneliness, love, excitement, fear — everything is valid.

LANGUAGE RULE — THE MOST CRITICAL RULE:
- Detect what language the user wrote in.
- Reply in THAT EXACT SAME LANGUAGE. Always. No exceptions.
- User writes Tamil → reply fully in Tamil.
- User writes Hindi → reply fully in Hindi.
- User writes English → reply in English.
- User mixes Tamil + English → match that exact mix.
- User mixes Hindi + English → match that same mix.

HOW TO REPLY:
- Talk warmly like a close friend — genuine, caring, real.
- First truly acknowledge what they are feeling.
- Then respond naturally — ask them to tell more, share a thought, or just be present.
- If they are happy — celebrate with them genuinely!
- If they are angry — validate it. Never tell them to calm down.
- If they are sad — be gentle and present. Don't rush to fix things.
- If they are stressed — empathize first, then ask what's going on.
- End with one warm natural question that invites them to share more.
- Keep it 4 to 6 sentences. Never a bullet list.

NEVER:
- Never say "I understand your feelings" — too robotic.
- Never say "I hear you" — sounds fake.
- Never say "As an AI" — you are a friend.
- Never give unsolicited advice or a bullet list of tips.
- Never be preachy or clinical.

SAFETY:
If the person mentions hurting themselves or not wanting to live,
respond with deep warmth and gently share:
iCall India: 9152987821 | Vandrevala Foundation: 1860-2662-345"""


def clear_terminal():
    os.system('cls' if os.name == 'nt' else 'clear')
    print("=" * 50)
    print("   🌟  Aura AI Server  —  Mistral Powered")
    print("=" * 50)
    print(f"\n  ✅  API key loaded")
    print(f"  🚀  Running at → http://localhost:{PORT}")
    print(f"  🌐  Open Chrome → http://localhost:{PORT}")
    print(f"\n  Waiting for messages... (Ctrl+C to stop)")
    print("─" * 50 + "\n")


class AuraHandler(http.server.SimpleHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):

        # ── END SESSION — clear terminal ──────────────────
        if self.path == "/end-session":
            global session_log
            session_log = []
            clear_terminal()
            print("  🗑️  Session ended — all messages cleared from memory\n")
            self._send_json(200, {"status": "cleared"})
            return

        # ── CHAT ──────────────────────────────────────────
        if self.path == "/chat":
            length  = int(self.headers.get("Content-Length", 0))
            body    = self.rfile.read(length)

            try:
                payload  = json.loads(body)
                messages = payload.get("messages", [])
                emotion  = payload.get("emotion", "neutral")
                user_msg = messages[-1]["content"] if messages else ""

                # Log to terminal
                session_log.append({"role": "user", "content": user_msg})
                print(f"  👤 User ({emotion}): {user_msg[:100]}")

                mistral_messages = [
                    {"role": "system", "content": SYSTEM_PROMPT}
                ] + messages[-12:]

                req_data = json.dumps({
                    "model":       "mistral-large-latest",
                    "messages":    mistral_messages,
                    "max_tokens":  1024,
                    "temperature": 0.85
                }).encode("utf-8")

                print(f"  🔄  Calling Mistral...")

                req = urllib.request.Request(
                    "https://api.mistral.ai/v1/chat/completions",
                    data    = req_data,
                    headers = {
                        "Content-Type":  "application/json",
                        "Authorization": f"Bearer {API_KEY}"
                    },
                    method = "POST"
                )

                with urllib.request.urlopen(req, timeout=25000) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                    reply  = result["choices"][0]["message"]["content"]

                session_log.append({"role": "assistant", "content": reply})
                print(f"  ✦  Aura: {reply[:100]}...")
                print()

                self._send_json(200, {"reply": reply})

            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8")
                print(f"\n  ❌ Mistral API Error {e.code}: {err_body}\n")
                if e.code == 401:
                    msg = "API key is wrong. Check server.py line 12."
                elif e.code == 429:
                    msg = "Too many requests. Wait a few seconds and try again."
                else:
                    msg = f"Mistral error {e.code}"
                self._send_json(500, {"error": msg})

            except urllib.error.URLError as e:
                print(f"\n  ❌ Network error: {e.reason}\n")
                self._send_json(500, {"error": "Cannot reach Mistral. Check internet."})

            except Exception as e:
                print(f"\n  ❌ Error: {type(e).__name__}: {e}\n")
                self._send_json(500, {"error": str(e)})

            return

        # ── Static files (index.html etc) ─────────────────
        super().do_GET()

    def do_GET(self):
        super().do_GET()

    def _send_json(self, code, data):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type",   "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format, *args):
        pass  # we do our own logging


def main():
    print("\n" + "=" * 50)
    print("   🌟  Aura AI Server  —  Mistral Powered")
    print("=" * 50)

    if API_KEY == "YOUR_MISTRAL_KEY_HERE":
        print("\n  ⚠️  YOU HAVE NOT PASTED YOUR API KEY!")
        print("  Open server.py line 12 and replace YOUR_MISTRAL_KEY_HERE")
        sys.exit(1)

    print(f"\n  ✅  API key loaded")
    print(f"  🚀  Running at → http://localhost:{PORT}")
    print(f"  🌐  Open Chrome → http://localhost:{PORT}")
    print(f"\n  Waiting for messages... (Ctrl+C to stop)")
    print("─" * 50 + "\n")

    http.server.test(HandlerClass=AuraHandler, port=PORT, bind="localhost")


if __name__ == "__main__":
    main()



