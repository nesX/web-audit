# app/crawler.py
import asyncio
import aiohttp
from . import fetcher
from . import parser
from . import validator
from . import store
from . import reporter
from . import config

async def worker(session, queue, semaphore):
    """Procesa URLs de la cola de forma concurrente."""
    while True:
        url = await queue.get()

        status, html = await fetcher.fetch(url, session)

        if status == 200 and html:
            meta = parser.parse(html, url)
            errors, warnings = await validator.validate(session, semaphore, meta, url)

            store.add_page(url, {
                "status": status,
                **meta,
                "errors": errors,
                "warnings": warnings,
            })

            for e in errors:
                reporter.log_error(url, e)
            for w in warnings:
                reporter.log_warning(url, w)

            async with store.queue_lock:
                for new_link in meta['links']:
                    if new_link not in store.seen_urls and store.total_links < config.MAX_PAGES:
                        store.seen_urls.add(new_link)
                        store.total_links += 1
                        await queue.put(new_link)
        else:
            reporter.log_error(url, f"No se pudo descargar (status: {status})")

        store.validated_links += 1
        reporter.update_progress(url)

        queue.task_done()

async def crawl(start_url):
    """Punto de entrada para el rastreo."""
    queue = asyncio.Queue()
    semaphore = asyncio.Semaphore(config.CONCURRENCY)

    # Normalizar la URL de inicio para evitar duplicados por la barra final
    normalized_url = start_url.rstrip('/')

    store.total_links = 1
    store.seen_urls.add(normalized_url)
    await queue.put(normalized_url)

    async with aiohttp.ClientSession() as session:
        tasks = []
        for _ in range(config.CONCURRENCY):
            task = asyncio.create_task(worker(session, queue, semaphore))
            tasks.append(task)

        await queue.join()

        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)
