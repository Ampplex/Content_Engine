"""
Web search utility for trend analysis and fact-checking.

Multi-provider approach:
  1. Google News RSS (primary) — free, no API key, no rate-limits, returns
     recent news articles with title + source + URL.
  2. DuckDuckGo (fallback)   — free, no API key, but rate-limits aggressively.

Both providers return a unified list of dicts: {title, url, snippet, query}.
"""

import re
import time
import random
import logging
import requests
from html import unescape
from typing import List, Dict
from xml.etree import ElementTree
from urllib.parse import quote_plus

logger = logging.getLogger("web_search")

# ── Configuration ──────────────────────────────────────────────────────────
GOOGLE_NEWS_MAX = 8          # max items to take from each Google News RSS query
DDG_MAX_RETRIES = 2          # retries per DDG query
DDG_BASE_DELAY = 3.0         # base backoff (seconds) for DDG retries
INTER_QUERY_DELAY = 1.5      # delay between successive queries (Google News is fast)
REQUEST_TIMEOUT = 10         # HTTP timeout in seconds

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
}

_TAG_RE = re.compile(r"<[^>]+>")          # strip HTML tags from descriptions


# ═══════════════════════════════════════════════════════════════════════════
#  Provider 1 — Google News RSS  (primary, never rate-limits)
# ═══════════════════════════════════════════════════════════════════════════

def _google_news_search(query: str, max_results: int = GOOGLE_NEWS_MAX) -> List[Dict[str, str]]:
    """
    Search Google News via its public RSS feed.
    Returns list of {title, url, snippet}.
    """
    encoded_q = quote_plus(query)
    rss_url = (
        f"https://news.google.com/rss/search?q={encoded_q}"
        "&hl=en-IN&gl=IN&ceid=IN:en"
    )
    try:
        resp = requests.get(rss_url, headers=_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)
        items = root.findall(".//item")

        results = []
        for item in items[:max_results]:
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")

            title = title_el.text.strip() if title_el is not None and title_el.text else ""
            url = link_el.text.strip() if link_el is not None and link_el.text else ""
            # Description is HTML — strip tags and unescape
            snippet = ""
            if desc_el is not None and desc_el.text:
                snippet = unescape(_TAG_RE.sub("", desc_el.text)).strip()

            if title and url:
                results.append({"title": title, "url": url, "snippet": snippet or title})

        logger.info(f"  [GoogleNews] '{query[:50]}' → {len(results)} results")
        return results

    except Exception as e:
        logger.warning(f"  [GoogleNews] Failed for '{query[:50]}': {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════════
#  Provider 2 — DuckDuckGo  (fallback)
# ═══════════════════════════════════════════════════════════════════════════

def _ddg_search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Search DuckDuckGo with retry + exponential backoff.
    Falls back silently if rate-limited.
    """
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        logger.warning("  [DDG] duckduckgo-search not installed, skipping")
        return []

    for attempt in range(1, DDG_MAX_RETRIES + 1):
        try:
            with DDGS() as ddgs:
                raw = ddgs.text(query, max_results=max_results)
                results = [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", ""),
                    }
                    for r in raw
                ]
                logger.info(f"  [DDG] '{query[:50]}' → {len(results)} results (attempt {attempt})")
                return results
        except Exception as e:
            err = str(e)
            if ("Ratelimit" in err or "202" in err) and attempt < DDG_MAX_RETRIES:
                wait = DDG_BASE_DELAY * (2 ** (attempt - 1)) + random.uniform(0, 1)
                logger.warning(f"  [DDG] Rate-limited (attempt {attempt}/{DDG_MAX_RETRIES}), waiting {wait:.1f}s")
                time.sleep(wait)
            else:
                logger.warning(f"  [DDG] Failed for '{query[:50]}' after {attempt} attempts: {e}")
                return []
    return []


# ═══════════════════════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════════════════════

def search_web(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Search the web using Google News RSS first, then DuckDuckGo as fallback.
    Returns list of {title, url, snippet}.
    """
    results = _google_news_search(query, max_results=max_results)
    if results:
        return results

    logger.info(f"  Google News returned 0, trying DuckDuckGo for '{query[:50]}'")
    return _ddg_search(query, max_results=max_results)


def search_multiple(queries: List[str], max_results_per_query: int = 4) -> List[Dict]:
    """
    Run multiple search queries and return a consolidated, deduplicated list.
    Each result dict includes the originating query.
    """
    all_results: List[Dict] = []
    seen_urls: set = set()

    for i, q in enumerate(queries):
        if i > 0:
            delay = INTER_QUERY_DELAY + random.uniform(0, 0.5)
            time.sleep(delay)

        hits = search_web(q, max_results=max_results_per_query)
        for h in hits:
            if h["url"] not in seen_urls:
                seen_urls.add(h["url"])
                h["query"] = q
                all_results.append(h)

    logger.info(f"  Total unique results across {len(queries)} queries: {len(all_results)}")
    return all_results
