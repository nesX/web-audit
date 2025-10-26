# app/store.py
import asyncio

# Lock para evitar condiciones de carrera al agregar URLs a la cola
queue_lock = asyncio.Lock()

# Diccionarios para almacenar metadatos y registrar duplicados
pages = {}
title_index = {}
description_index = {}
seen_urls = set()

# Contadores para el progreso y resumen
total_links = 0
validated_links = 0
error_count = 0
warning_count = 0

def add_page(url, meta):
    """Agrega una página y sus metadatos al store."""
    normalized_url = url.rstrip('/')
    global pages
    pages[normalized_url] = meta
    seen_urls.add(normalized_url)

def is_visited(url):
    """Verifica si una URL ya ha sido visitada."""
    normalized_url = url.rstrip('/')
    return normalized_url in seen_urls

def register_title(url, title):
    """Registra un title para detectar duplicados."""
    global title_index
    if title not in title_index:
        title_index[title] = []
    title_index[title].append(url)

def register_description(url, desc):
    """Registra una meta description para detectar duplicados."""
    global description_index
    if desc not in description_index:
        description_index[desc] = []
    description_index[desc].append(url)
