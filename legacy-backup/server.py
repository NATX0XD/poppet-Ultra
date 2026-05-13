import http.server
import json
import os
import secrets
import socketserver
import time
from http import cookies
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PORT = 8080
HOST = os.environ.get("POPCAT_HOST", "127.0.0.1")
DB_FILE = ROOT / "leaderboard.json"
STATE_FILE = ROOT / "game_state.json"
INDEX_FILE = ROOT / "index.html"
ADMIN_FILE = ROOT / "chillcatpop.html"

ADMIN_PASSWORD = os.environ.get("POPCAT_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
ADMIN_SESSION = secrets.token_urlsafe(24)
START_COUNTDOWN_SECONDS = 5

DEFAULT_STATE = {
    "running": False,
    "countdown_until": None,
    "start_at": None,
    "round_id": 0,
    "round_started_at": None,
    "round_ended_at": None,
    "round_start_scores": {},
    "last_round_summary": None,
}


def ensure_file(path: Path, default):
    if not path.exists():
        path.write_text(json.dumps(default, indent=2, ensure_ascii=False))


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return default


def save_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def load_state():
    state = DEFAULT_STATE.copy()
    state.update(load_json(STATE_FILE, {}))
    changed = False
    now_ms = int(time.time() * 1000)

    if not isinstance(state.get("round_start_scores"), dict):
        state["round_start_scores"] = {}
        changed = True

    countdown_until = state.get("countdown_until")
    if countdown_until is not None:
        try:
            countdown_until = int(countdown_until)
        except (TypeError, ValueError):
            countdown_until = None
            state["countdown_until"] = None
            changed = True
    if countdown_until is not None and now_ms >= countdown_until:
        state["running"] = True
        state["start_at"] = countdown_until
        state["round_started_at"] = countdown_until
        state["countdown_until"] = None
        changed = True
    if changed:
        save_json(STATE_FILE, state)
    return state


def set_state(**updates):
    state = load_state()
    state.update(updates)
    save_json(STATE_FILE, state)
    return state


def leaderboard_items():
    data = load_json(DB_FILE, {})
    return sorted(data.items(), key=lambda item: item[1], reverse=True)


def current_score_snapshot():
    return {name: int(score) for name, score in leaderboard_items()}


def build_round_summary(start_scores):
    current_scores = current_score_snapshot()
    start_scores = start_scores or {}
    names = sorted(set(start_scores) | set(current_scores))
    players = []

    for name in names:
        previous = int(start_scores.get(name, 0) or 0)
        current = int(current_scores.get(name, 0) or 0)
        gained = current - previous
        if gained > 0:
            players.append({"name": name, "score": gained})

    players.sort(key=lambda item: item["score"], reverse=True)
    return {
        "total_players": len(players),
        "total_points": sum(item["score"] for item in players),
        "players": players,
        "top3": players[:3],
    }


def is_admin(handler):
    raw_cookie = handler.headers.get("Cookie", "")
    jar = cookies.SimpleCookie()
    try:
        jar.load(raw_cookie)
    except cookies.CookieError:
        return False
    token = jar.get("popcat_admin")
    return token is not None and token.value == ADMIN_SESSION


def read_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    if not raw:
        return {}
    return json.loads(raw)


def send_json(handler, payload, status=200, extra_headers=None):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    if extra_headers:
        for key, value in extra_headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(json.dumps(payload).encode("utf-8"))


def send_text(handler, text, content_type="text/html; charset=utf-8", status=200):
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.end_headers()
    handler.wfile.write(text.encode("utf-8"))


ensure_file(DB_FILE, {})
ensure_file(STATE_FILE, DEFAULT_STATE.copy())


class PopcatHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        if path in ("/", "/index.html"):
            return self.serve_local_file(INDEX_FILE)

        if path in ("/chillcatpop", "/chillcatpop/"):
            return self.serve_local_file(ADMIN_FILE)

        if path == "/api/leaderboard":
            leaderboard = [
                {"name": name, "score": score}
                for name, score in leaderboard_items()[:3]
            ]
            return send_json(self, leaderboard)

        if path == "/api/game-state":
            return send_json(self, load_state())

        if path == "/api/admin/players":
            if not is_admin(self):
                return send_json(self, {"error": "unauthorized"}, status=401)
            players = [
                {"name": name, "score": score}
                for name, score in leaderboard_items()
            ]
            return send_json(self, {"players": players, "count": len(players)})

        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/sync":
            payload = read_body(self)
            username = payload.get("username")
            score = payload.get("score")

            if username and isinstance(score, int):
                data = load_json(DB_FILE, {})
                data[username] = max(data.get(username, 0), score)
                save_json(DB_FILE, data)

                sorted_scores = sorted(data.values(), reverse=True)
                rank = sorted_scores.index(data[username]) + 1
                return send_json(self, {"status": "success", "rank": rank})

            return send_json(self, {"error": "bad request"}, status=400)

        if path == "/api/admin/login":
            payload = read_body(self)
            password = payload.get("password", "")
            if password == ADMIN_PASSWORD:
                return send_json(
                    self,
                    {"status": "ok"},
                    extra_headers={
                        "Set-Cookie": (
                            f"popcat_admin={ADMIN_SESSION}; Path=/; HttpOnly; SameSite=Lax"
                        )
                    },
                )
            return send_json(self, {"error": "unauthorized"}, status=401)

        if path == "/api/admin/start":
            if not is_admin(self):
                return send_json(self, {"error": "unauthorized"}, status=401)
            payload = read_body(self)
            delay_seconds = payload.get("delay_seconds", START_COUNTDOWN_SECONDS)
            try:
                delay_seconds = max(0, int(delay_seconds))
            except (TypeError, ValueError):
                delay_seconds = START_COUNTDOWN_SECONDS
            countdown_until = int(time.time() * 1000) + delay_seconds * 1000
            current_state = load_state()
            state = set_state(
                running=False,
                countdown_until=countdown_until,
                start_at=None,
                round_started_at=None,
                round_ended_at=None,
                round_id=int(current_state.get("round_id", 0)) + 1,
                round_start_scores=current_score_snapshot(),
                last_round_summary=None,
            )
            return send_json(self, state)


        if path == "/api/admin/stop":
            if not is_admin(self):
                return send_json(self, {"error": "unauthorized"}, status=401)
            state = load_state()
            summary = build_round_summary(state.get("round_start_scores") or {})
            stopped_state = set_state(
                running=False,
                countdown_until=None,
                start_at=None,
                round_ended_at=int(time.time() * 1000),
                round_start_scores=current_score_snapshot(),
                last_round_summary=summary,
            )
            return send_json(self, stopped_state)

        if path == "/api/admin/player/delete":
            if not is_admin(self):
                return send_json(self, {"error": "unauthorized"}, status=401)
            payload = read_body(self)
            username = payload.get("username")
            if not username:
                return send_json(self, {"error": "bad request"}, status=400)
            data = load_json(DB_FILE, {})
            data.pop(username, None)
            save_json(DB_FILE, data)
            return send_json(self, {"status": "ok"})

        if path == "/api/admin/player/reset":
            if not is_admin(self):
                return send_json(self, {"error": "unauthorized"}, status=401)
            payload = read_body(self)
            username = payload.get("username")
            if not username:
                return send_json(self, {"error": "bad request"}, status=400)
            data = load_json(DB_FILE, {})
            if username in data:
                data[username] = 0
                save_json(DB_FILE, data)
            return send_json(self, {"status": "ok"})

        if path == "/api/admin/reset-all":
            if not is_admin(self):
                return send_json(self, {"error": "unauthorized"}, status=401)
            data = load_json(DB_FILE, {})
            for key in list(data.keys()):
                data[key] = 0
            save_json(DB_FILE, data)
            return send_json(self, {"status": "ok"})

        return send_json(self, {"error": "not found"}, status=404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def serve_local_file(self, path: Path):
        if not path.exists():
            return send_json(self, {"error": "not found"}, status=404)
        content_type = "text/html; charset=utf-8"
        if path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        elif path.suffix == ".png":
            content_type = "image/png"
        elif path.suffix == ".mp3":
            content_type = "audio/mpeg"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(path.read_bytes())


class ThreadingHTTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


with ThreadingHTTPServer((HOST, PORT), PopcatHandler) as httpd:
    print(f"Server started at http://{HOST}:{PORT}")
    print(f"Admin password: {ADMIN_PASSWORD}")
    httpd.serve_forever()
