"""
Weekly email (opt-in via user_profiles.weekly_email): three plain lines about the user's portfolio, what's coming
up for their holdings, and the market, plus one lesson. Sent through Resend on the Saturday run.
"""
import os
from datetime import date, timedelta

import httpx
from loguru import logger
from sqlalchemy import text

APP_URL = os.getenv("APP_URL", "https://stockscout-five.vercel.app")
FROM = os.getenv("EMAIL_FROM", "StockScout <no-reply@golash.in>")
# keep in step with frontend/src/lib/lessons.ts
LESSONS = [("first-money", "Your first ₹1,000: where it should go"), ("demat", "Opening a demat account, step by step"),
           ("index-funds", "Index funds and ETFs"), ("mutual-funds", "Mutual funds: Direct, Regular and SIPs"),
           ("pe", "P/E: what you pay for ₹1 of profit"), ("roe", "Return on equity"), ("debt", "Debt: when borrowing becomes a risk"),
           ("falls", "How much do prices fall, and is that normal?"), ("tips", "Tips, pump-and-dumps and SEBI registration"),
           ("tax", "Tax when you sell"), ("fno", "Futures and options: why most people lose")]


def rupees(x: float) -> str:
    """Indian grouping: 1,23,456."""
    n = int(round(abs(x)))
    s = str(n)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        s = ",".join(([head] if head else []) + parts) + "," + tail
    return ("−₹" if x < 0 else "₹") + s


def compose(value_now: float | None, value_week_ago: float | None, events: list[tuple], nifty_week: float | None, today: date) -> tuple[str, str]:
    """Subject and plain-text body. events: (company name, 'results'|'dividend', date, amount)."""
    lines = []
    if value_now and value_week_ago:
        ch = value_now - value_week_ago
        lines.append(f"Your portfolio is worth {rupees(value_now)}, {'up' if ch >= 0 else 'down'} {rupees(abs(ch))} ({ch / value_week_ago * 100:+.1f}%) this week.")
    else:
        lines.append("You haven't recorded any holdings yet. Practice mode lets you try with pretend money first.")
    if events:
        bits = [f"{n} {'reports results' if k == 'results' else f'goes ex-dividend (₹{a:.2f} a share)'} on {d:%d %b}" for n, k, d, a in events[:3]]
        lines.append("Coming up: " + "; ".join(bits) + ".")
    else:
        lines.append("Nothing scheduled for your holdings in the next two weeks.")
    if nifty_week is not None:
        lines.append(f"The Nifty 50 {'rose' if nifty_week >= 0 else 'fell'} {abs(nifty_week) * 100:.1f}% this week.")
    slug, title = LESSONS[today.isocalendar()[1] % len(LESSONS)]
    body = "\n\n".join(lines) + f"\n\nThis week's 2-minute lesson: {title}\n{APP_URL}/learn/{slug}\n\n" \
        f"Open StockScout: {APP_URL}/home\nYou get this because you turned on the weekly email. Turn it off on your Home page.\n" \
        "Information, not investment advice."
    subject = f"Your StockScout week: portfolio {(value_now - value_week_ago) / value_week_ago * 100:+.1f}%" if value_now and value_week_ago else "Your StockScout week"
    return subject, body


async def send_weekly(db) -> int:
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        logger.info("weekly email: RESEND_API_KEY not set, skipping")
        return 0
    users = (await db.execute(text("""
        select u.id, u.email from auth.users u join user_profiles p on p.user_id = u.id
        where p.weekly_email and u.email is not null and u.email_confirmed_at is not null"""))).all()
    if not users:
        return 0
    today = date.today()
    nifty = (await db.execute(text("""
        select (select close from daily_prices p join stocks s on s.id = p.stock_id where s.ticker = '^NSEI' order by date desc limit 1)
             / nullif((select close from daily_prices p join stocks s on s.id = p.stock_id where s.ticker = '^NSEI' and date <= current_date - 7 order by date desc limit 1), 0) - 1"""))).scalar()
    sent = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for uid, email in users:
            vals = (await db.execute(text("""
                select sum(h.quantity * (select close from daily_prices d where d.stock_id = h.stock_id order by date desc limit 1)),
                       sum(h.quantity * (select close from daily_prices d where d.stock_id = h.stock_id and d.date <= current_date - 7 order by date desc limit 1))
                from holdings h where h.user_id = :u"""), {"u": uid})).one()
            events = (await db.execute(text("""
                select distinct s.name, e.kind, e.event_date, coalesce(e.amount, 0) from stock_events e
                join stocks s on s.id = e.stock_id join holdings h on h.stock_id = e.stock_id and h.user_id = :u
                where e.kind in ('results', 'dividend') and e.event_date between current_date and current_date + 14
                order by e.event_date limit 3"""), {"u": uid})).all()
            subject, body = compose(float(vals[0]) if vals[0] else None, float(vals[1]) if vals[1] else None,
                                    [(n, k, d, float(a)) for n, k, d, a in events], float(nifty) if nifty is not None else None, today)
            r = await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}"},
                                  json={"from": FROM, "to": [email], "subject": subject, "text": body})
            if r.status_code < 300:
                sent += 1
            else:
                logger.warning(f"weekly email failed for one user: {r.status_code}")
    return sent
