"""Live-editable runtime config, backed by backend/.env.

Reading always reflects the current process env. Writing updates the
process env immediately (so the next pipeline run picks it up with no
restart) and persists the change back to the .env file on disk.
"""

import os

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")

EDITABLE_KEYS = {
    "USE_MOCK_DATA": {"type": "bool", "help": "Toggle to false to hit the live Jira REST API."},
    "STALE_THRESHOLD_HOURS": {"type": "int", "help": "Hours without update before STALE fires."},
    "STUCK_THRESHOLD_PCT": {"type": "int", "help": "% of sprint length before an In Progress ticket is STUCK."},
    "SPRINT_TOTAL_DAYS": {"type": "int", "help": "Sprint length in days, used for STUCK threshold math."},
}


def get_all():
    return {
        key: {"value": os.environ.get(key, ""), **meta}
        for key, meta in EDITABLE_KEYS.items()
    }


def update(values):
    unknown = set(values) - set(EDITABLE_KEYS)
    if unknown:
        raise ValueError(f"Unknown setting(s): {', '.join(sorted(unknown))}")

    for key, value in values.items():
        os.environ[key] = str(value)

    lines = []
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r") as f:
            lines = f.readlines()

    seen = set()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key = stripped.split("=", 1)[0]
        if key in values:
            lines[i] = f"{key}={values[key]}\n"
            seen.add(key)

    for key, value in values.items():
        if key not in seen:
            lines.append(f"{key}={value}\n")

    with open(ENV_PATH, "w") as f:
        f.writelines(lines)

    return get_all()
