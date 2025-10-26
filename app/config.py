# app/config.py

# Concurrencia
CONCURRENCY = 10

# Máximo de páginas a rastrear
MAX_PAGES = 1000

# Rangos de longitud para title y meta description
TITLE_RANGE = (30, 70)
DESC_RANGE = (70, 160)

# Timeout para las peticiones HTTP
TIMEOUT = 10

# Dominio base para el rastreo
BASE_DOMAIN = "localhost"

# Directorio para los logs
LOG_DIR = "logs"
