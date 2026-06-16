from __future__ import annotations

import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urljoin, urlparse

from curl_cffi import requests as cc

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

IMPERSONATE = "chrome124"
TIMEOUT = 20
BACKOFF_SECONDS = [0, 3, 7, 13]
DEFAULT_HEADERS = {
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}


def session(referer: str = ""):
    s = cc.Session(impersonate=IMPERSONATE, timeout=TIMEOUT)
    headers = dict(DEFAULT_HEADERS)
    if referer:
        headers["Referer"] = referer
    s.headers.update(headers)
    return s


def fetch_html(s, url: str) -> str:
    last_error = None
    for backoff in BACKOFF_SECONDS:
        if backoff:
            time.sleep(backoff)
        try:
            response = s.get(url)
            if response.status_code == 429:
                last_error = RuntimeError(f"{url} returned HTTP 429")
                continue
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def node_text(node) -> str:
    return clean_text(node.get_text(" ", strip=True) if node else "")


def to_absolute_url(base_url: str, url: str) -> str:
    value = clean_text(url)
    if not value:
        return ""
    if value.startswith("//"):
        return "https:" + value
    return urljoin(base_url, value)


def first_int(value, default: int = 0) -> int:
    match = re.search(r"-?\d[\d,]*", str(value or ""))
    if not match:
        return default
    try:
        return int(match.group(0).replace(",", ""))
    except ValueError:
        return default


def parse_recommend(value: str) -> int:
    text = clean_text(value)
    if "-" in text:
        return first_int(text.split("-", 1)[0])
    return first_int(text)


def parse_price(title: str) -> tuple[str, int | None]:
    text = clean_text(title)
    candidates = re.findall(r"\(([^)]*(?:원|무료|무배|달러|USD|\$)[^)]*)\)", text, flags=re.IGNORECASE)
    price_text = ""
    for candidate in reversed(candidates):
        if re.search(r"\d[\d,\.]*\s*(?:만)?\s*원", candidate):
            price_text = candidate
            break
    if not price_text and candidates:
        price_text = candidates[-1]
    if not price_text:
        won_match = re.search(r"(\d[\d,\.]*\s*원)", text)
        price_text = won_match.group(1) if won_match else ""
    if not price_text and re.search(r"일시\s*무료|무료\s*$|\(무료\)", text):
        price_text = "무료"
    amount = parse_price_amount(price_text) if price_text else None
    return price_text, amount


def parse_price_amount(value: str) -> int | None:
    text = clean_text(value).replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(만)?\s*원", text)
    if match:
        number = float(match.group(1))
        if match.group(2):
            number *= 10000
        return int(number)
    if re.search(r"무료", text) and not re.search(r"\d", text):
        return 0
    if re.search(r"0\s*원", text):
        return 0
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if match and ("원" in text or "₩" in text):
        return int(float(match.group(1)))
    return None


def parse_shop_from_title(title: str) -> str:
    match = re.match(r"\s*\[([^\]]{1,40})\]", clean_text(title))
    return clean_text(match.group(1)) if match else ""


def parse_post_id_from_query(url: str, key: str = "no") -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    value = query.get(key, [""])[0]
    return clean_text(value)


def parse_post_id_from_path(url: str) -> str:
    parsed = urlparse(url)
    match = re.search(r"/(\d+)(?:[/?#]|$)", parsed.path)
    if match:
        return match.group(1)
    return parse_post_id_from_query(url, "document_srl")


def parse_korea_datetime(value: str) -> str:
    text = clean_text(value)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%y.%m.%d %H:%M:%S", "%y/%m/%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.replace(tzinfo=timezone(timedelta(hours=9))).isoformat()
        except ValueError:
            pass
    return ""


def is_sold_or_expired(text: str) -> tuple[bool, bool]:
    value = clean_text(text)
    sold_out = bool(re.search(r"품절|매진|sold\s*out", value, flags=re.IGNORECASE))
    expired = bool(re.search(r"종료|마감|끝났|expired", value, flags=re.IGNORECASE))
    return sold_out, expired
