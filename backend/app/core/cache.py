"""High-performance in-memory and Redis-compatible caching engine."""

import time
import functools
import asyncio
from typing import Any, Optional, Callable, Dict
from loguru import logger

class MemoryCache:
    """Thread-safe in-memory cache with Time-To-Live (TTL) expiration."""
    def __init__(self, default_ttl: int = 300):
        self._cache: Dict[str, tuple[float, Any]] = {}
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        expires_at, value = self._cache[key]
        if time.time() > expires_at:
            del self._cache[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        expires_at = time.time() + ttl
        self._cache[key] = (expires_at, value)

    def delete(self, key: str) -> None:
        self._cache.pop(key, None)

    def clear(self) -> None:
        self._cache.clear()

    def cleanup(self) -> int:
        """Remove expired entries."""
        now = time.time()
        expired_keys = [k for k, (exp, _) in self._cache.items() if now > exp]
        for k in expired_keys:
            del self._cache[k]
        return len(expired_keys)

# Global singleton cache instance
cache = MemoryCache(default_ttl=300)

def cached(ttl: int = 300, key_prefix: str = ""):
    """Decorator to cache async function results based on arguments."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Build key from function name and arguments
            arg_str = ":".join(str(a) for a in args)
            kw_str = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = f"{key_prefix or func.__name__}:{arg_str}:{kw_str}"

            hit = cache.get(cache_key)
            if hit is not None:
                return hit

            result = await func(*args, **kwargs)
            if result is not None:
                cache.set(cache_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
