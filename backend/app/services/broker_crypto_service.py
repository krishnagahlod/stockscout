import os
import json
from cryptography.fernet import Fernet
from loguru import logger

def get_cipher() -> Fernet:
    """Gets the Fernet cipher instance using the key from environment."""
    key = os.environ.get("BROKER_ENCRYPTION_KEY")
    if not key:
        logger.warning("BROKER_ENCRYPTION_KEY not found in environment, falling back to dummy key for development only!")
        key = Fernet.generate_key()
    return Fernet(key)

def encrypt_credentials(creds_dict: dict) -> str:
    """Encrypts a dictionary of broker credentials into a base64 Fernet string."""
    try:
        json_str = json.dumps(creds_dict)
        cipher = get_cipher()
        encrypted_bytes = cipher.encrypt(json_str.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to encrypt broker credentials: {e}")
        raise ValueError("Encryption failed")

def decrypt_credentials(encrypted_str: str) -> dict:
    """Decrypts a base64 Fernet string back into a dictionary of credentials."""
    try:
        cipher = get_cipher()
        decrypted_bytes = cipher.decrypt(encrypted_str.encode('utf-8'))
        json_str = decrypted_bytes.decode('utf-8')
        return json.loads(json_str)
    except Exception as e:
        logger.error(f"Failed to decrypt broker credentials: {e}")
        raise ValueError("Decryption failed")
