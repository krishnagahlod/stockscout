"""Run: python tests/test_email.py"""
import os
import sys
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.email_service import compose, rupees

assert rupees(123456.4) == "₹1,23,456" and rupees(999) == "₹999" and rupees(-1500) == "−₹1,500" and rupees(12345678) == "₹1,23,45,678"

subject, body = compose(42300, 41100, [("ITC Ltd.", "results", date(2027, 1, 28), 0.0), ("Coal India Ltd.", "dividend", date(2027, 2, 4), 5.25)], 0.012, date(2026, 11, 28))
assert subject == "Your StockScout week: portfolio +2.9%", subject
assert "up ₹1,200 (+2.9%) this week" in body, body
assert "ITC Ltd. reports results on 28 Jan" in body and "Coal India Ltd. goes ex-dividend (₹5.25 a share) on 04 Feb" in body
assert "Nifty 50 rose 1.2%" in body and "/learn/" in body and "Turn it off" in body

subject, body = compose(None, None, [], None, date(2026, 11, 28))
assert subject == "Your StockScout week" and "haven't recorded any holdings" in body and "Nothing scheduled" in body
print("email: ok")
