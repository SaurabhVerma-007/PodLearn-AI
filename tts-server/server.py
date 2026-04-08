from flask import Flask, request, jsonify, send_file
import os
import io
import base64
import requests
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

app = Flask(__name__)

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# ElevenLabs voice IDs — natural, expressive podcast-quality voices
# Jamie (A) = Jessica: Playful, Bright, Warm | Alex (B) = Eric: Smooth, Trustworthy
VOICES = {
    "A": "cgSgspJ2msm6clMCkdW9",
    "B": "cjVigY5qzO86Huf0OWal",
}

MODEL_ID = "eleven_turbo_v2_5"

if ELEVENLABS_API_KEY:
    print(f"[tts-server] ELEVENLABS_API_KEY loaded (length={len(ELEVENLABS_API_KEY)})")
else:
    print("[tts-server] WARNING: ELEVENLABS_API_KEY is not set — TTS requests will fail!")

def get_voice_id(host: str) -> str:
    return VOICES.get(host, VOICES["A"])

def synthesize_elevenlabs(text: str, voice_id: str) -> dict:
    """Call ElevenLabs /with-timestamps endpoint to get audio + char-level timing."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.80,
            "style": 0.35,
            "use_speaker_boost": True,
        },
    }
    r = requests.post(url, json=payload, headers=headers, timeout=60)
    if not r.ok:
        error_text = r.text[:500]
        print(f"[tts-server] ElevenLabs error {r.status_code}: {error_text}")
        raise ValueError(f"ElevenLabs error {r.status_code}: {error_text}")
    data = r.json()
    return {
        "audio_base64": data["audio_base64"],
        "chars": data["alignment"]["characters"],
        "char_starts": data["alignment"]["character_start_times_seconds"],
        "char_ends": data["alignment"]["character_end_times_seconds"],
    }

@app.route("/tts", methods=["POST"])
def tts():
    data = request.json
    text = data.get("text", "").strip()
    host = data.get("host", "A")

    if not text:
        return jsonify({"error": "text is required"}), 400

    if not ELEVENLABS_API_KEY:
        return jsonify({"error": "ELEVENLABS_API_KEY not configured — set it in your .env file"}), 500

    voice_id = get_voice_id(host)

    try:
        result = synthesize_elevenlabs(text, voice_id)
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "provider": "elevenlabs",
        "api_key_set": bool(ELEVENLABS_API_KEY),
    })

if __name__ == "__main__":
    app.run(port=5001, debug=True)
