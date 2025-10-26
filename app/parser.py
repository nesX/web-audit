# app/parser.py
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from . import config

def parse(html, base_url):
    """
    Extrae metadatos y enlaces de un documento HTML.

    Args:
        html (str): El contenido HTML.
        base_url (str): La URL base para resolver enlaces relativos.

    Returns:
        dict: Un diccionario con los metadatos extraídos.
    """
    soup = BeautifulSoup(html, 'lxml')

    title = soup.title.string.strip() if soup.title else ""
    description = soup.find('meta', attrs={'name': 'description'})
    description = description['content'].strip() if description else ""

    links = []
    for link in soup.find_all('a', href=True):
        href = link['href']
        if not href.startswith(('http://', 'https://')):
            abs_url = urljoin(base_url, href).rstrip('/')
            if config.BASE_DOMAIN in abs_url:
                links.append(abs_url)

    images = []
    for img in soup.find_all(['img', 'amp-img'], src=True):
        src = img['src']
        if not src.startswith(('http://', 'https://')):
            images.append(urljoin(base_url, src))
        else:
            images.append(src)

    return {
        "title": title,
        "description": description,
        "links": links,
        "images": images,
    }
