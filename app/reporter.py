# app/reporter.py
import os
import datetime
from . import store
from . import config

# Nombres de archivo para los logs
error_log_file = ""
warning_log_file = ""

def setup_logging():
    """Crea el directorio de logs y los archivos para la ejecución actual."""
    global error_log_file, warning_log_file

    if not os.path.exists(config.LOG_DIR):
        os.makedirs(config.LOG_DIR)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    error_log_file = os.path.join(config.LOG_DIR, f"errors_{timestamp}.log")
    warning_log_file = os.path.join(config.LOG_DIR, f"warnings_{timestamp}.log")

    # Crear archivos vacíos
    with open(error_log_file, "w") as f:
        pass
    with open(warning_log_file, "w") as f:
        pass

def log_error(url, msg):
    """Registra un mensaje de error en el archivo de logs."""
    store.error_count += 1
    with open(error_log_file, "a") as f:
        f.write(f"[{url}] - {msg}\\n")

def log_warning(url, msg):
    """Registra un mensaje de advertencia en el archivo de logs."""
    store.warning_count += 1
    with open(warning_log_file, "a") as f:
        f.write(f"[{url}] - {msg}\\n")

def update_progress(url):
    """Muestra el progreso del rastreo en la consola."""
    if store.total_links > 0:
        pct = (store.validated_links / store.total_links) * 100
        print(f"[{store.validated_links}/{store.total_links}] {pct:.1f}% - {url}", end="\\r")

def print_summary():
    """Muestra el resumen final del rastreo."""
    print("\\n" + "="*50)
    print("Crawl finalizado:")

    validated_pct = 0
    if store.total_links > 0:
        validated_pct = (store.validated_links / store.total_links) * 100

    print(f"  Páginas totales: {store.total_links}")
    print(f"  Validadas: {store.validated_links} ({validated_pct:.1f}%)")
    print(f"  Errores: {store.error_count}")
    print(f"  Advertencias: {store.warning_count}")
    print(f"Logs: {error_log_file}, {warning_log_file}")
    print("="*50)
