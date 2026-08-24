"""Demo authentication — hardcoded showcase accounts, opaque in-memory sessions.

Not applied to any existing route in this pass. `require_auth` is available
for `Depends(auth.require_auth)` on any future protected route, but today
only gates the frontend UI (see AuthGate in the frontend App.jsx) — these are
publicly-shown demo credentials, not a real secret, so hardening every
existing endpoint wasn't worth the added surface for a showcase demo.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _session_ttl_minutes():
    # Read at call time, not import time — main.py's load_dotenv() runs
    # after `import auth`, so a module-level read would always see the
    # default (matches the lazy-read pattern in risk_engine._thresholds()).
    return float(os.environ.get("AUTH_SESSION_TTL_MINUTES", "30"))


# Publicly-known demo credential, shown on the login screen itself — not a
# real secret. Single account, full app access. Keep in sync with
# frontend/src/pages/LoginPage.jsx DEMO_ACCOUNT.
DEMO_ACCOUNTS = {
    "scrummaster": {
        "password": "sprint2026",
        "displayName": "Alex Rivera",
        "role": "Scrum Master",
        "avatarInitial": "A",
    },
}

# token -> {username, displayName, role, avatarInitial, expiresAt}
_sessions: dict[str, dict] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


def _now():
    return datetime.now(timezone.utc)


def _purge_expired():
    now = _now()
    for token in [t for t, s in _sessions.items() if s["expiresAt"] <= now]:
        del _sessions[token]


def _public_user(session: dict) -> dict:
    return {k: session[k] for k in ("username", "displayName", "role", "avatarInitial")}


@router.post("/login")
def login(body: LoginRequest):
    account = DEMO_ACCOUNTS.get(body.username.strip().lower())
    if not account or not secrets.compare_digest(body.password, account["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    _purge_expired()
    username = body.username.strip().lower()
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "username": username,
        "displayName": account["displayName"],
        "role": account["role"],
        "avatarInitial": account["avatarInitial"],
        "expiresAt": _now() + timedelta(minutes=_session_ttl_minutes()),
    }
    return {"token": token, "user": _public_user(_sessions[token])}


def _extract_token(authorization):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip()


def require_auth(authorization: str = Header(default=None)) -> dict:
    """Reusable guard dependency — not applied to existing routes in this
    pass, available for Depends(auth.require_auth) on any future protected
    route."""
    _purge_expired()
    token = _extract_token(authorization)
    session = _sessions.get(token) if token else None
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid — please log in again")
    return session


@router.get("/me")
def me(session: dict = Depends(require_auth)):
    return _public_user(session)


@router.post("/logout", status_code=204)
def logout(authorization: str = Header(default=None)):
    token = _extract_token(authorization)
    if token:
        _sessions.pop(token, None)
    return None
