from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta

from bs4 import BeautifulSoup
from curl_cffi import requests as cc

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE = "https://suto.co.kr"
LIST_URL = f"{BASE}/cpevent?isActive=1"
IMPERSONATE = "chrome124"
TIMEOUT = 20
DETAIL_LIMIT = 80
LIST_PAGE_LIMIT = 10
DETAIL_DELAY_SECONDS = float(os.environ.get("SUTO_DETAIL_DELAY_SECONDS", "1.1"))
RATE_LIMIT_BACKOFF_SECONDS = [4, 9, 16]
MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
)
ALLOWED_PLATFORMS = {
    "유튜브 이벤트",
    "홈페이지 이벤트",
    "네이버 블로그 이벤트",
    "앱 전용 이벤트",
}


def main() -> None:
    events = fetch_list()
    payload = []
    with session() as s:
        for index, event in enumerate(events[:DETAIL_LIMIT]):
            if index > 0:
                time.sleep(DETAIL_DELAY_SECONDS)
            detail = fetch_detail_with_fallbacks(event["originalUrl"])
            payload.append({**event, **detail})
    print(json.dumps(payload, ensure_ascii=False))


def session():
    s = cc.Session(impersonate=IMPERSONATE, timeout=TIMEOUT)
    s.headers.update(
        {
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            "Referer": BASE,
        }
    )
    return s


def fetch_list() -> list[dict]:
    with session() as s:
        last_error = None
        for attempt in range(4):
            try:
                events = []
                seen_ids: set[str] = set()
                for page in range(1, LIST_PAGE_LIMIT + 1):
                    url = LIST_URL if page == 1 else f"{LIST_URL}&page={page}&seek=1"
                    response = s.get(url)
                    if response.status_code == 403:
                        raise RuntimeError("suto.co.kr returned HTTP 403")
                    response.raise_for_status()
                    page_events = parse_list(response.text, seen_ids, len(events))
                    events.extend(page_events)
                    if len(events) >= DETAIL_LIMIT:
                        break
                    time.sleep(0.25)
                return events[:DETAIL_LIMIT]
            except Exception as exc:
                last_error = exc
                if attempt < 3:
                    time.sleep(2**attempt * 3)
        raise RuntimeError(f"failed to fetch suto list: {last_error}")


def parse_list(html: str, seen_ids: set[str] | None = None, start_rank: int = 0) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    events = []
    seen_ids = seen_ids if seen_ids is not None else set()

    for tr in soup.select("tr"):
        link = tr.find("a", href=re.compile(r"^/cpevent/\d+"))
        if not link:
            continue
        match = re.search(r"/cpevent/(\d+)", link["href"])
        if not match:
            continue
        event_id = match.group(1)
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)

        title = first_text(tr.select("td.td_subject a[href^='/cpevent/']"))
        platform_icon = tr.select_one("td.td_subject img.site_icon")
        platform = ((platform_icon.get("title") or platform_icon.get("alt") or "").strip() if platform_icon else "")
        if platform not in ALLOWED_PLATFORMS:
            continue

        deadline_cells = tr.select("td.td_datetime")
        deadline_date_text = deadline_cells[0].get_text(strip=True) if len(deadline_cells) >= 1 else ""
        deadline_time_text = deadline_cells[1].get_text(strip=True) if len(deadline_cells) >= 2 else ""
        deadline_text = " ".join(part for part in [deadline_date_text, deadline_time_text] if part)

        prize_tags = unique_texts(tr.select("td.td_gift #event_tag_org a.event_tag_key"))
        if not prize_tags:
            prize_tags = unique_texts(tr.select("td.td_gift a.event_tag_key"))

        rank = start_rank + len(events) + 1
        entries = first_number([cell.get_text(strip=True) for cell in tr.select("td.td_num")])

        events.append(
            {
                "id": f"suto-{event_id}",
                "eventId": event_id,
                "title": title,
                "originalTitle": title,
                "originalUrl": f"{BASE}/cpevent/{event_id}",
                "applyUrl": f"{BASE}/bbs/link.php?bo_table=cpevent&wr_id={event_id}&no=1",
                "platform": platform or "이벤트",
                "rank": rank,
                "bookmarkCount": entries,
                "deadlineText": deadline_text,
                "deadlineDate": normalize_deadline_date(deadline_date_text),
                "prizeText": ", ".join(prize_tags),
                "source": f"슈퍼투데이 · {platform or '이벤트'}",
                "url": f"{BASE}/cpevent/{event_id}",
                "crawledFrom": "슈퍼투데이",
            }
        )

    return events


def fetch_detail(s, url: str) -> dict:
    try:
        response = None
        for attempt, backoff in enumerate([0, *RATE_LIMIT_BACKOFF_SECONDS]):
            if backoff:
                time.sleep(backoff)
            response = s.get(url)
            if response.status_code != 429:
                break
            if attempt >= len(RATE_LIMIT_BACKOFF_SECONDS):
                break
        if response is None:
            raise RuntimeError("No response returned.")
        response.raise_for_status()
        body, links = parse_detail(response.text)
        lines = normalize_lines(body.splitlines())
        return {
            "originalText": "\n".join(lines),
            "originalLines": lines,
            "externalLinks": links,
            "detailCrawlStatus": "ok" if lines else "empty",
            "detailCrawlMessage": "Fetched with curl_cffi chrome impersonation.",
        }
    except Exception as exc:
        return {
            "originalText": "",
            "originalLines": [],
            "externalLinks": [],
            "detailCrawlStatus": "failed",
            "detailCrawlMessage": str(exc),
        }


def fetch_detail_with_fallbacks(url: str) -> dict:
    attempts = [
        ("desktop", {}),
        (
            "mobile",
            {
                "User-Agent": MOBILE_UA,
                "Sec-CH-UA-Mobile": "?1",
                "Sec-CH-UA-Platform": '"Android"',
                "Viewport-Width": "390",
            },
        ),
    ]

    results = []
    for label, headers in attempts:
        with session() as s:
            s.headers.update(headers)
            result = fetch_detail(s, url)
            result["detailCrawlMode"] = label
            results.append(result)
            if result["detailCrawlStatus"] == "ok" and len(result["originalLines"]) >= 2:
                return result
            time.sleep(0.35)

    return max(results, key=lambda item: len(item["originalLines"]))


def parse_detail(html: str) -> tuple[str, list[str]]:
    soup = BeautifulSoup(html, "lxml")
    body_scopes = unique_nodes(
        soup.select("#bo_v_con")
        + soup.select(".bo_v_con")
        + soup.select(".view_content")
        + soup.select(".item-box")
    )
    body_lines = []
    for scope in body_scopes:
        body_lines.extend(normalize_lines(scope.get_text("\n", strip=True).splitlines()))
    body_text = "\n".join(body_lines)

    link_pattern = re.compile(
        "|".join(
            [
                r"youtube\.com/watch",
                r"youtube\.com/shorts/",
                r"youtube\.com/post/",
                r"youtube\.com/embed/",
                r"youtu\.be/",
                r"instagram\.com/",
                r"naver\.me/",
                r"forms\.gle/",
                r"docs\.google\.com/forms",
                r"form\.naver\.com",
            ]
        )
    )
    links = []
    seen = set()
    scopes = []
    for selector in ["#bo_v_con", ".bo_v_con", ".item-box", ".view_content", "#bo_v_link"]:
        scopes.extend(soup.select(selector))
    if not scopes:
        scopes = [soup]

    for scope in scopes:
        for a in scope.find_all("a", href=True):
            add_link(links, seen, a["href"].strip(), link_pattern)
        for iframe in scope.find_all("iframe", src=True):
            add_link(links, seen, iframe["src"].strip(), link_pattern)

    for el in soup.find_all(["input", "textarea"]):
        for attr in ("value", "data-original", "data-url", "placeholder"):
            add_link(links, seen, (el.get(attr) or "").strip(), link_pattern)

    for match in re.finditer(r"https?://[^\s\"'<>)]+", body_text):
        add_link(links, seen, match.group(0), link_pattern)

    return body_text, links


def unique_nodes(nodes) -> list:
    values = []
    seen = set()
    for node in nodes:
        key = id(node)
        if key in seen:
            continue
        seen.add(key)
        values.append(node)
    return values


def add_link(links: list[str], seen: set[str], value: str, pattern: re.Pattern) -> None:
    if value and pattern.search(value) and value not in seen:
        seen.add(value)
        links.append(value)


def normalize_deadline_date(value: str) -> str:
    today = datetime.now()
    if value == "오늘":
        return today.strftime("%Y-%m-%d")
    if value == "내일":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if value == "모레":
        return (today + timedelta(days=2)).strftime("%Y-%m-%d")
    match = re.search(r"(\d{1,2})-(\d{1,2})", value)
    if not match:
        return ""
    month = int(match.group(1))
    day = int(match.group(2))
    year = today.year
    if today.month >= 11 and month <= 2:
        year += 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def first_text(nodes) -> str:
    for node in nodes:
        text = node.get_text(" ", strip=True)
        if text:
            return text
    return ""


def unique_texts(nodes) -> list[str]:
    values = []
    for node in nodes:
        text = node.get_text(" ", strip=True)
        if text and text not in values:
            values.append(text)
    return values


def first_number(values: list[str]) -> int | None:
    for value in values:
        if value.isdigit():
            return int(value)
    return None


def normalize_lines(lines) -> list[str]:
    out = []
    seen = set()
    for line in lines:
        value = re.sub(r"\s+", " ", str(line)).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
        if len(out) >= 32:
            break
    return out


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
