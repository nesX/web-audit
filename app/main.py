# app/main.py
import asyncio
import sys
from . import crawler
from . import reporter

def main():
    """Punto de entrada principal de la aplicación."""
    start_url = "https://escuelasmex.local"
    if len(sys.argv) > 1:
        start_url = sys.argv[1]

    reporter.setup_logging()

    print(f"Iniciando rastreo en: {start_url}")

    try:
        asyncio.run(crawler.crawl(start_url))
    except KeyboardInterrupt:
        print("\\nInterrumpido por el usuario.")
    finally:
        reporter.print_summary()

if __name__ == "__main__":
    main()
