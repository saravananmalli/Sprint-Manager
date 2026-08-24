"""Leadership-ready sprint report: text template, PDF export, email send.

Report text is assembled deterministically from the same velocity/health/
risk computations used elsewhere — no LLM call, so it's fast, free, and
always internally consistent with the Dashboard/Analytics numbers.
"""

import io
import os
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText

import agent_runner
import health_score
import projects_store
import risk_engine


def _hours_since(iso_ts, now):
    ts = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    return round((now - ts).total_seconds() / 3600)


def build_report(project_id, now=None):
    now = now or datetime.now(timezone.utc)
    project = projects_store.get_project(project_id)
    tickets = risk_engine.tag_tickets(project["tickets"], now=now)
    velocity = health_score.compute_velocity(project, today=now.date())
    health = health_score.compute_health_score(tickets)
    trend = health_score.compute_trend(health_score.load_history(project_id))

    done = [t for t in tickets if t["status"] == "Done"]
    todo = [t for t in tickets if t["status"] in ("Todo", "Backlog")]
    in_progress = [t for t in tickets if t not in done and t not in todo]

    at_risk = [t for t in tickets if t["riskTags"]]
    at_risk.sort(key=lambda t: (-len(t["riskTags"]), t["lastUpdated"]))
    top_risks = at_risk[:3]

    recent_wins = sorted(done, key=lambda t: t["lastUpdated"], reverse=True)[:3]

    risk_owner_counts = {}
    for t in at_risk:
        name = t["assignee"]["name"]
        risk_owner_counts[name] = risk_owner_counts.get(name, 0) + 1
    scrum_master_ask = None
    if risk_owner_counts:
        top_owner = max(risk_owner_counts, key=risk_owner_counts.get)
        scrum_master_ask = f"Run a focused 1:1 with {top_owner} to clear blockers."

    def risk_reason(t):
        if "BLOCKED" in t["riskTags"] and t["blockers"]:
            return f"blocked by {t['blockers'][0]}"
        return f"no update in {_hours_since(t['lastUpdated'], now)}h"

    lines = []
    lines.append(f"📊 {project['name']} — Sprint status")
    lines.append(
        f"Day {velocity['daysElapsed']} of {velocity['daysElapsed'] + velocity['daysRemaining']} · "
        f"Velocity {velocity['velocity']}% · Projected {velocity['projectedCompletion']} / {project['totalCommitted']} pts · "
        f"{velocity['sprintStatus']}"
    )
    lines.append(
        f"Health {health['score']}/100 ({trend}) · {project['pointsDone']}/{project['totalCommitted']} pts done "
        f"({round(project['pointsDone'] / project['totalCommitted'] * 100) if project['totalCommitted'] else 0}%)"
    )
    lines.append("")
    lines.append("🎯 Sprint goals")
    lines.append(f"• {project['totalCommitted']} pts committed across {len(tickets)} tickets")
    lines.append(f"• {len(done)} Done · {len(in_progress)} In Progress · {len(todo)} To Do")
    lines.append("")
    lines.append(f"🔴 Top risks ({len(top_risks)})")
    for t in top_risks:
        lines.append(f"• {t['id']} {t['summary']} — {risk_reason(t)}  [{t['assignee']['name']}]")
    lines.append("")
    lines.append(f"🏆 Recent wins ({len(recent_wins)})")
    for t in recent_wins:
        lines.append(f"• {t['id']} {t['summary']}  [{t['assignee']['name']}]")
    if scrum_master_ask:
        lines.append("")
        lines.append("🧑‍💼 Scrum Master ask")
        lines.append(f"• {scrum_master_ask}")

    text = "\n".join(lines)

    return {
        "text": text,
        "sprintName": project["sprintName"],
        "days": f"{velocity['daysElapsed']} of {velocity['daysElapsed'] + velocity['daysRemaining']}",
        "velocity": velocity["velocity"],
        "projected": velocity["projectedCompletion"],
        "totalCommitted": project["totalCommitted"],
        "health": health["score"],
        "trend": trend,
        "sprintStatus": velocity["sprintStatus"],
        "scrumMasterAsk": scrum_master_ask,
        "generatedAt": now.isoformat(),
    }


def build_pdf(project_id):
    from fpdf import FPDF

    report = build_report(project_id)
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    page_width = pdf.w - pdf.l_margin - pdf.r_margin
    for line in report["text"].split("\n"):
        if not line:
            pdf.ln(6)
            continue
        safe_line = line.encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(page_width, 6, safe_line)
    return bytes(pdf.output())


def send_email(project_id):
    """Send the leadership report by email, or dry-run if unconfigured."""
    project = projects_store.get_project(project_id)
    report = build_report(project_id)

    if os.environ.get("EMAIL_DRY_RUN", "").lower() == "true":
        return {"sent": True, "dryRun": True, "detail": "EMAIL_DRY_RUN=true — logged only"}

    smtp_host = os.environ.get("SMTP_HOST")
    env_key = project["prefix"].upper()
    recipients = os.environ.get(f"EMAIL_RECIPIENTS_{env_key}", "")

    if not smtp_host or not recipients:
        return {
            "sent": False,
            "dryRun": False,
            "detail": f"Set SMTP_HOST + EMAIL_RECIPIENTS_{env_key} (or EMAIL_DRY_RUN=true) in backend/.env.",
        }

    msg = MIMEText(report["text"])
    msg["Subject"] = f"{project['name']} — Sprint status"
    msg["From"] = os.environ.get("SMTP_USER", "sprint-agent@example.com")
    msg["To"] = recipients

    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        server.starttls()
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(msg["From"], recipients.split(","), msg.as_string())

    return {"sent": True, "dryRun": False, "detail": f"Sent to {recipients}"}
