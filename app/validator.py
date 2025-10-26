# app/validator.py
import aiohttp
import asyncio
from . import config
from . import store
from . import reporter

async def check_url(session, semaphore, url, error_list, message_prefix):
    """Verifica una URL (enlace o imagen) de forma asíncrona."""
    try:
        async with semaphore:
            async with session.head(url, timeout=config.TIMEOUT, ssl=False) as response:
                if response.status >= 400:
                    error_list.append(f"{message_prefix}: {url} (status {response.status})")
    except (aiohttp.ClientError, asyncio.TimeoutError):
        error_list.append(f"No se pudo verificar {message_prefix.lower()}: {url}")

async def validate(session, semaphore, meta, url):
    """
    Aplica las reglas SEO y verifica enlaces e imágenes.

    Args:
        session (aiohttp.ClientSession): La sesión de aiohttp.
        semaphore (asyncio.Semaphore): El semáforo para limitar la concurrencia.
        meta (dict): Los metadatos de la página.
        url (str): La URL de la página.

    Returns:
        tuple: (errors, warnings)
    """
    errors = []
    warnings = []

    # Validaciones de Title
    if not meta['title']:
        errors.append("Title vacío")
    elif len(meta['title']) < config.TITLE_RANGE[0] or len(meta['title']) > config.TITLE_RANGE[1]:
        warnings.append(f"Title fuera de rango ({len(meta['title'])} caracteres)")

    # Validaciones de Meta Description
    if not meta['description']:
        errors.append("Meta description vacía")
    elif len(meta['description']) < config.DESC_RANGE[0] or len(meta['description']) > config.DESC_RANGE[1]:
        warnings.append(f"Description fuera de rango ({len(meta['description'])} caracteres)")

    # Detección de duplicados
    if meta['title']:
        if meta['title'] in store.title_index:
            original_url = store.title_index[meta['title']][0]
            errors.append(f"Title duplicado: '{meta['title']}' (original: {original_url})")
        store.register_title(url, meta['title'])

    if meta['description']:
        if meta['description'] in store.description_index:
            original_url = store.description_index[meta['description']][0]
            errors.append(f"Description duplicada: '{meta['description']}' (original: {original_url})")
        store.register_description(url, meta['description'])

    # Verificación de enlaces e imágenes
    tasks = []
    for link in meta['links']:
        tasks.append(check_url(session, semaphore, link, errors, "Enlace roto"))
    for img in meta['images']:
        tasks.append(check_url(session, semaphore, img, errors, "Imagen rota"))

    if tasks:
        await asyncio.gather(*tasks)

    return errors, warnings
