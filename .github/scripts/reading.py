"""Rebuild the About page bookshelf from Goodreads' public RSS feeds.

Goodreads closed its API in 2020 and the RSS feeds send no CORS headers, so the page can't fetch
them in the browser. This runs in a GitHub Action instead: it rewrites the block between the
reading:start / reading:end markers in about/index.html and saves 16-color pixel covers to books/.
Visitors only ever load files from this site. Needs Pillow; everything else is stdlib.
"""
import html
import io
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from PIL import Image

USER = "196218728"
PROFILE = "https://www.goodreads.com/user/show/" + USER
FEED = "https://www.goodreads.com/review/list_rss/" + USER + "?shelf={shelf}&sort=date_read&order=d&page={page}"
UA = "Mozilla/5.0 (bookshelf updater; +https://bransonbailey.github.io/about/)"
ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "about" / "index.html"
COVERS = ROOT / "books"
COVER_W, COVER_H, COLORS = 40, 60, 16  # shown at 2x with image-rendering: pixelated
RECENT = 3
START = "<!-- reading:start"
END = "<!-- reading:end -->"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def when(s):
    s = (s or "").strip()
    return parsedate_to_datetime(s) if s else None


def shelf(name):
    books, seen = [], set()
    for page in range(1, 11):  # 100 per page; stop at the first page with nothing new
        root = ET.fromstring(get(FEED.format(shelf=name, page=page)))
        new = 0
        for it in root.iter("item"):
            bid = (it.findtext("book_id") or "").strip()
            if not bid or bid in seen:
                continue
            seen.add(bid); new += 1
            books.append({
                "id": bid,
                "title": (it.findtext("title") or "").strip(),
                "author": (it.findtext("author_name") or "").strip(),
                "cover": (it.findtext("book_large_image_url") or "").strip(),
                "read": when(it.findtext("user_read_at")),
                "added": when(it.findtext("user_date_added")),
            })
        if not new:
            break
    return books


def split_series(title):
    """'Iron Gold (Red Rising Saga, #4)' -> ('Iron Gold', 'Red Rising Saga #4')"""
    m = re.match(r"^(.*?)\s*\(([^()]+?),?\s*#([\d.]+)\)$", title)
    return (m.group(1), m.group(2) + " #" + m.group(3)) if m else (title, "")


def cover(book):
    """Download once and reduce to a small 16-color pixel cover. Returns the site path or None."""
    out = COVERS / (book["id"] + ".png")
    if out.exists():
        return out.name
    if not book["cover"] or "nophoto" in book["cover"]:
        return None
    try:
        img = Image.open(io.BytesIO(get(book["cover"]))).convert("RGB")
    except Exception as e:  # a missing cover shouldn't stop the update
        print("cover failed for", book["title"], e, file=sys.stderr)
        return None
    w, h = img.size  # center-crop to 2:3, then shrink
    if w * 3 > h * 2:
        nw = h * 2 // 3; img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = w * 3 // 2; img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    img = img.resize((COVER_W, COVER_H), Image.BOX)
    img = img.quantize(COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    COVERS.mkdir(exist_ok=True)
    img.save(out, optimize=True)
    return out.name


def book_html(b, indent, cls):
    e = html.escape
    title, series = split_series(b["title"])
    src = cover(b)
    img = (f'<img class="book-cover" src="../books/{e(src)}" width="80" height="120" alt="" loading="lazy">'
           if src else '<span class="book-cover none" aria-hidden="true"></span>')
    by = e(b["author"]) + (f' <span class="dim">&middot; {e(series)}</span>' if series else "")
    return (f'{indent}<a class="{cls}" href="https://www.goodreads.com/book/show/{e(b["id"])}" rel="noopener">\n'
            f'{indent}  {img}\n'
            f'{indent}  <span class="book-text"><span class="book-title">{e(title)}</span>'
            f'<span class="book-by">{by}</span></span>\n'
            f'{indent}</a>\n')


def render(now, done):
    year = datetime.now(timezone.utc).year
    recent = sorted(done, key=lambda b: (b["read"] or b["added"] or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)
    recent = [b for b in recent if b["read"]][:RECENT] or recent[:RECENT]
    count = sum(1 for b in done if b["read"] and b["read"].year == year)
    now = sorted(now, key=lambda b: b["added"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:2]

    s = '  <div class="shelf">\n    <div class="about-card shelf-now">\n      <div class="stat-label">Now reading</div>\n'
    s += "".join(book_html(b, "      ", "book") for b in now) or '      <p class="book-by">Between books right now.</p>\n'
    s += '    </div>\n    <div class="about-card shelf-recent">\n      <div class="stat-label">Recently finished</div>\n      <div class="shelf-row">\n'
    s += "".join(book_html(b, "        ", "book book-sm") for b in recent)
    s += '      </div>\n    </div>\n  </div>\n'
    note = (f"{count} book{'s' if count != 1 else ''} finished in {year} &middot; " if count else "")
    s += f'  <p class="note shelf-note">{note}<a href="{PROFILE}" rel="noopener">Full shelf on Goodreads &rarr;</a></p>\n'
    return s


def main():
    now, done = shelf("currently-reading"), shelf("read")
    if not done:  # a broken or empty feed must never wipe the shelf
        sys.exit("read shelf came back empty; leaving the page alone")
    page = PAGE.read_text(encoding="utf-8")
    a, b = page.find(START), page.find(END)
    if a < 0 or b < a:
        sys.exit("reading markers not found in " + str(PAGE))
    a = page.index("\n", a) + 1
    page = page[:a] + render(now, done) + "  " + page[b:]
    PAGE.write_text(page, encoding="utf-8")
    keep = {p for p in re.findall(r'\.\./books/([\w.-]+\.png)', page)}
    for p in COVERS.glob("*.png"):  # drop covers that fell off the shelf
        if p.name not in keep:
            p.unlink()
    print(f"now: {len(now)}, read: {len(done)}, covers kept: {len(keep)}")


if __name__ == "__main__":
    main()
