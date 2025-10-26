# app/fetcher.py
import aiohttp
import asyncio
from . import config

async def fetch(url, session):
    """
    Descarga el contenido HTML de una URL.

    Args:
        url (str): La URL a descargar.
        session (aiohttp.ClientSession): La sesión de aiohttp.

    Returns:
        tuple: (status_code, text) o (None, None) si hay un error.
    """
    try:
        async with session.get(url, timeout=config.TIMEOUT, ssl=False) as response:
            return response.status, await response.text()
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        print(f"Error fetching {url}: {e}")
        return None, None
