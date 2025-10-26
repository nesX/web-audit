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

            for new_link in meta['links']:
                if not store.is_visited(new_link) and store.total_links < config.MAX_PAGES:
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

    store.total_links = 1
    await queue.put(start_url)

    async with aiohttp.ClientSession() as session:
        tasks = []
        for _ in range(config.CONCURRENCY):
            task = asyncio.create_task(worker(session, queue, semaphore))
            tasks.append(task)

        await queue.join()

        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)
