from __future__ import annotations

import re
import os
import subprocess
import sys
import time
import tempfile
from http.cookies import SimpleCookie
from pathlib import Path
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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
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
            if response.status_code == 430 and "fmkorea.com" in urlparse(url).netloc:
                solved = solve_fmkorea_security_challenge(s, response, url)
                if solved:
                    return solved
            if response.status_code == 429:
                last_error = RuntimeError(f"{url} returned HTTP 429")
                continue
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def solve_fmkorea_security_challenge(s, response, url: str) -> str:
    html = response.text or ""
    if "에펨코리아 보안 시스템" not in html or "fm5(" not in html:
        return ""

    token_match = re.search(r"fm5\('([^']+)'\s*,\s*'([^']+)'\)", html)
    lite_match = re.search(r"var _cookie = '([^']+)'\s*\+\s*\"=\"\s*\+\s*escape\('([^']+)'\)", html)
    if not token_match:
        return ""

    if lite_match:
        for domain in ("www.fmkorea.com", ".fmkorea.com"):
            s.cookies.set(lite_match.group(1), lite_match.group(2), domain=domain, path="/")
            s.cookies.set(f"g_{lite_match.group(1)}", lite_match.group(2), domain=domain, path="/")

    module_response = s.get("https://www.fmkorea.com/mc/mc.php")
    module_response.raise_for_status()
    module_source = module_response.text
    if not is_expected_fmkorea_challenge_module(module_source):
        raise RuntimeError("fmkorea challenge module changed unexpectedly")

    cookie_lines = run_fmkorea_challenge_module(module_source, token_match.group(1), token_match.group(2))
    for line in cookie_lines:
        cookie = SimpleCookie()
        cookie.load(line)
        for key, morsel in cookie.items():
            domain = morsel["domain"] or ".fmkorea.com"
            path = morsel["path"] or "/"
            s.cookies.set(key, morsel.value, domain=domain, path=path)

    challenge_url = url + ("&" if "?" in url else "?") + "ddosCheckOnly=1"
    retry = s.get(challenge_url)
    if retry.status_code == 430:
        return ""
    retry.raise_for_status()
    return retry.text


def is_expected_fmkorea_challenge_module(source: str) -> bool:
    required = ["export function fm5", "function __wbg_get_imports", "/mc/mcw.php"]
    blocked = ["process", "require", "child_process", "node:", "XMLHttpRequest", "localStorage"]
    return all(value in source for value in required) and not any(value in source for value in blocked)


def run_fmkorea_challenge_module(module_source: str, token: str, digest: str) -> list[str]:
    sanitized_source = module_source.replace(
        "new URL('/mc/mcw.php', import.meta.url)",
        "'https://www.fmkorea.com/mc/mcw.php'",
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        module_path = Path(tmpdir) / "mc.mjs"
        runner_path = Path(tmpdir) / "run.mjs"
        module_path.write_text(sanitized_source, encoding="utf-8")
        runner_path.write_text(
            f"""
class WindowMock {{}}
globalThis.Window = WindowMock;
const doc = {{
  _cookies: [],
  set cookie(value) {{ this._cookies.push(value); }},
  get cookie() {{ return this._cookies.join('\\n'); }}
}};
const win = new WindowMock();
win.document = doc;
win.window = win;
win.self = win;
globalThis.document = doc;
globalThis.window = win;
globalThis.self = win;
globalThis.global = globalThis;
globalThis.process = undefined;
const mod = await import('./mc.mjs');
await mod.default();
mod.fm5('{token}', '{digest}');
console.log(doc.cookie);
""",
            encoding="utf-8",
        )
        completed = subprocess.run(
            ["node", str(runner_path)],
            cwd=tmpdir,
            env=node_safe_env(tmpdir),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
            check=True,
        )
    return [line.strip() for line in completed.stdout.splitlines() if line.strip()]


def node_safe_env(tmpdir: str) -> dict[str, str]:
    safe = {}
    for key in ("PATH", "Path", "SYSTEMROOT", "SystemRoot", "WINDIR", "windir"):
        if os.environ.get(key):
            safe[key] = os.environ[key]
    safe["HOME"] = tmpdir
    safe["TEMP"] = tmpdir
    safe["TMP"] = tmpdir
    return safe


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
