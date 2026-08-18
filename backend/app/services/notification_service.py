import httpx
from typing import Optional, List
from loguru import logger
from app.core.config import settings


class NotificationService:
    """
    Multi-channel notification dispatcher supporting Resend email API and Telegram Bot API.
    Gracefully defaults to console logging if credentials or recipients are not configured.
    """

    def __init__(self):
        self.resend_api_key = settings.RESEND_API_KEY
        self.default_email = settings.DEFAULT_ALERT_EMAIL
        self.telegram_token = settings.TELEGRAM_BOT_TOKEN
        self.telegram_chat_id = settings.TELEGRAM_CHAT_ID

    async def send_email(
        self,
        subject: str,
        text: str,
        html: Optional[str] = None,
        recipient_email: Optional[str] = None,
    ) -> bool:
        to_email = recipient_email or self.default_email
        if not self.resend_api_key or not to_email:
            logger.info(
                f"[EMAIL ALERT LOG - Resend not fully configured] To: {to_email or 'Unconfigured'} | Subject: {subject} | Body: {text}"
            )
            return False

        headers = {
            "Authorization": f"Bearer {self.resend_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": "AI Co-Pilot Alerts <alerts@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "text": text,
        }
        if html:
            payload["html"] = html

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.resend.com/emails", json=payload, headers=headers
                )
                if resp.status_code in (200, 201):
                    logger.info(f"Successfully sent Resend email alert to {to_email}")
                    return True
                else:
                    logger.warning(
                        f"Failed to send email via Resend: {resp.status_code} - {resp.text}"
                    )
                    return False
        except Exception as e:
            logger.error(f"Exception while sending Resend email alert: {e}")
            return False

    async def send_telegram(self, message: str) -> bool:
        if not self.telegram_token or not self.telegram_chat_id:
            logger.info(f"[TELEGRAM ALERT LOG - Bot not configured] Message:\n{message}")
            return False

        url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
        payload = {
            "chat_id": self.telegram_chat_id,
            "text": message,
            "parse_mode": "Markdown",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    logger.info("Successfully sent Telegram alert notification")
                    return True
                else:
                    logger.warning(
                        f"Failed to send Telegram notification: {resp.status_code} - {resp.text}"
                    )
                    return False
        except Exception as e:
            logger.error(f"Exception while sending Telegram notification: {e}")
            return False

    async def send_alert(
        self,
        title: str,
        message: str,
        severity: str = "info",
        recipient_email: Optional[str] = None,
        strategy_name: Optional[str] = None,
    ) -> dict:
        """
        Dispatches multi-channel notification across Email and Telegram.
        Returns delivery status dictionary.
        """
        severity_emojis = {
            "critical": "🚨",
            "warning": "⚠️",
            "info": "ℹ️",
            "success": "✅",
        }
        emoji = severity_emojis.get(severity.lower(), "📊")
        
        prefix = f"[{strategy_name}] " if strategy_name else ""
        subject = f"{emoji} {prefix}{title}"
        
        telegram_msg = f"*{subject}*\n\n{message}\n\n_Severity:_ `{severity.upper()}`"
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e0e0e0; rounded: 10px;">
            <h2 style="color: {'#e11d48' if severity=='critical' else '#d97706' if severity=='warning' else '#2563eb'};">
                {subject}
            </h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333333;">{message.replace(chr(10), '<br>')}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #888888;">Automated alert from AI Investment Co-Pilot Strategy Engine.</p>
        </div>
        """

        email_ok = await self.send_email(subject, message, html_body, recipient_email)
        telegram_ok = await self.send_telegram(telegram_msg)

        return {
            "email_sent": email_ok,
            "telegram_sent": telegram_ok,
            "title": title,
            "severity": severity
        }


notification_service = NotificationService()
