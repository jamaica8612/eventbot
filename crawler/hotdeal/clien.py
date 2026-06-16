from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .common import (
    clean_text,
    first_int,
    is_sold_or_expired,
    node_text,
    parse_korea_datetime,
    parse_post_id_from_path,
    parse_price,
    parse_shop_from_title,
    to_absolute_url,
)

BASE_URL = "https://www.clien.net"
LIST_URL = f"{BASE_URL}/service/board/jirum"


def parse_list(html: str, limit: int) -> tuple[list[dict], int]:
    soup = BeautifulSoup(html, "lxml")
    deals = []
    failures = 0
    seen = set()

    for link in soup.find_all("a", href=True):
        if len(deals) >= limit:
            break
        try:
            href = link.get("href", "")
            if "/service/board/jirum/" not in href or "#comment" in href:
                continue
            title = clean_text(link.get_text(" ", strip=True))
            if not title:
                continue
            post_id = parse_post_id_from_path(href)
            if not post_id or post_id in seen:
                continue
            seen.add(post_id)

            row = find_row(link)
            if row and "notice" in (row.get("class") or []):
                continue
            text = clean_text(row.get_text(" ", strip=True) if row else title)
            price_text, price_amount = parse_price(title)
            sold_out, expired = is_sold_or_expired(text)
            timestamp = row.select_one(".timestamp") if row else None
            category = node_text(row.select_one(".category") if row else None)
            if not category:
                category_match = re.search(r"(상품정보|이벤트정보|오프라인정보|공동구매정보|해외구매정보)", text)
                category = category_match.group(1) if category_match else ""
            comment_link = row.select_one("a[href*='#comment-point']") if row else None
            comment_count = first_int(node_text(comment_link))
            recommend_count = first_int(node_text(row.select_one(".list_symph span") if row else None))

            deals.append(
                {
                    "source": "clien",
                    "sourceBoard": "jirum",
                    "sourcePostId": post_id,
                    "title": title,
                    "priceText": price_text,
                    "priceAmount": price_amount,
                    "currency": "KRW",
                    "shop": parse_shop_from_title(title),
                    "category": category,
                    "recommendCount": recommend_count,
                    "commentCount": comment_count,
                    "url": to_absolute_url(BASE_URL, href),
                    "dealUrl": "",
                    "thumbnail": "",
                    "postedAt": parse_korea_datetime(node_text(timestamp)),
                    "isSoldOut": sold_out,
                    "isExpired": expired,
                }
            )
        except Exception:
            failures += 1

    return deals, failures


def find_row(link):
    node = link
    for _ in range(6):
        node = node.parent
        if not node:
            return None
        classes = node.get("class") or []
        if "list_item" in classes:
            return node
    return None
