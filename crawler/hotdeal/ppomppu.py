from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .common import (
    clean_text,
    first_int,
    is_sold_or_expired,
    node_text,
    parse_korea_datetime,
    parse_post_id_from_query,
    parse_price,
    parse_recommend,
    parse_shop_from_title,
    to_absolute_url,
)

BASE_URL = "https://www.ppomppu.co.kr"
BOARDS = [
    {"board_id": "ppomppu", "label": "뽐뿌 국내"},
    {"board_id": "ppomppu4", "label": "뽐뿌 해외"},
    {"board_id": "ppomppu8", "label": "뽐뿌 알리"},
]


def build_url(board_id: str) -> str:
    return f"{BASE_URL}/zboard/zboard.php?id={board_id}"


def parse_list(html: str, board_id: str, limit: int) -> tuple[list[dict], int]:
    soup = BeautifulSoup(html, "lxml")
    deals = []
    failures = 0
    seen = set()

    for row in soup.select("tr.baseList"):
        if len(deals) >= limit:
            break
        try:
            title_link = row.select_one("a.baseList-title[href*='view.php']")
            if not title_link:
                continue
            href = title_link.get("href", "")
            post_id = parse_post_id_from_query(href, "no")
            if not post_id or post_id in seen:
                continue
            seen.add(post_id)

            title = clean_text(title_link.get_text(" ", strip=True))
            if not title:
                continue
            price_text, price_amount = parse_price(title)
            text = clean_text(row.get_text(" ", strip=True))
            sold_out, expired = is_sold_or_expired(text)
            category = node_text(row.select_one("small.baseList-small")).strip("[]")
            comment_count = first_int(node_text(row.select_one(".baseList-c")))
            recommend_count = parse_recommend(node_text(row.select_one("td.baseList-rec")))
            time_cell = row.select_one("td[title]")
            posted_at = parse_korea_datetime(time_cell.get("title") if time_cell else "")
            thumb_img = row.select_one("a.baseList-thumb img")
            thumbnail = to_absolute_url(BASE_URL, thumb_img.get("src", "")) if thumb_img else ""

            deals.append(
                {
                    "source": "ppomppu",
                    "sourceBoard": board_id,
                    "sourcePostId": f"{board_id}:{post_id}",
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
                    "thumbnail": thumbnail,
                    "postedAt": posted_at,
                    "isSoldOut": sold_out,
                    "isExpired": expired,
                }
            )
        except Exception:
            failures += 1

    return deals, failures
