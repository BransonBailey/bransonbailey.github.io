"""Rebuild the About page bookshelf.

Goodreads closed its API in 2020 and has since shut off its RSS feeds and logged-out shelf pages, so
"Now reading" is scraped from the public profile page and "Recently finished" comes from
books/finished.json (newest first; add an entry when you finish a book: id, title, author, and
optionally series, cover URL, and read date for the yearly count). This runs in a GitHub
Action: it rewrites the block between the
reading:start / reading:end markers in about/index.html and saves 16-color pixel covers to books/.
Visitors only ever load files from this site. Needs Pillow; everything else is stdlib.
"""
import html
import io
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

USER = "196218728"
PROFILE = "https://www.goodreads.com/user/show/" + USER
BOOK = "https://www.goodreads.com/book/show/{id}"
UA = "Mozilla/5.0 (bookshelf updater; +https://bransonbailey.github.io/about/)"
ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "about" / "index.html"
COVERS = ROOT / "books"
FINISHED = COVERS / "finished.json"
COVER_W, COVER_H, COLORS = 40, 60, 16  # shown at 2x with image-rendering: pixelated
RECENT = 3
START = "<!-- reading:start"
END = "<!-- reading:end -->"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def now_reading():
    """Books in the profile page's 'currently reading' box (the profile is public; the shelf pages aren't)."""
    page = get(PROFILE).decode("utf-8", "replace")
    a = page.find('id="currentlyReadingReviews"')
    if a < 0:
        return []
    blocks = page[a:].split('class="Updates')[1:]
    books = []
    for blk in blocks:
        t = re.search(r'class="bookTitle" href="/book/show/(\d+)[^"]*">([^<]+)</a>', blk)
        if not t:
            break  # ran past the box into the next section
        au = re.search(r'class="authorName"[^>]*>([^<]+)</a>', blk)
        img = re.search(r'<img [^>]*src="([^"]+)"', blk)
        books.append({
            "id": t.group(1),
            "title": html.unescape(t.group(2)).strip(),
            "author": html.unescape(au.group(1)).strip() if au else "",
            "cover": re.sub(r"\._S[XY]\d+_", "", img.group(1)) if img else "",
        })
    return books


def finished():
    """Entries from books/finished.json (newest first), plus this year's finished count."""
    data = json.loads(FINISHED.read_text(encoding="utf-8"))
    books = [{"cover": "", "series": "", **{**ent, "id": str(ent["id"])}} for ent in data["books"][:RECENT]]
    year = datetime.now(timezone.utc).year
    count = data.get("before_tracking", 0) + sum(1 for ent in data["books"] if str(ent.get("read", ""))[:4] == str(year))
    return books, count


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
    series = b.get("series") or series
    src = cover(b)
    img = (f'<img class="book-cover" src="../books/{e(src)}" width="80" height="120" alt="" loading="lazy">'
           if src else '<span class="book-cover none" aria-hidden="true"></span>')
    by = e(b["author"]) + (f' <span class="dim">&middot; {e(series)}</span>' if series else "")
    return (f'{indent}<a class="{cls}" href="https://www.goodreads.com/book/show/{e(b["id"])}" rel="noopener">\n'
            f'{indent}  {img}\n'
            f'{indent}  <span class="book-text"><span class="book-title">{e(title)}</span>'
            f'<span class="book-by">{by}</span></span>\n'
            f'{indent}</a>\n')


def render(now, recent, count):
    year = datetime.now(timezone.utc).year
    now = now[:2]

    s = '  <div class="shelf">\n    <div class="about-card shelf-now">\n      <div class="stat-label">Now reading</div>\n'
    s += "".join(book_html(b, "      ", "book") for b in now) or '      <p class="book-by">Between books right now.</p>\n'
    s += '    </div>\n    <div class="about-card shelf-recent">\n      <div class="stat-label">Recently finished</div>\n      <div class="shelf-row">\n'
    s += "".join(book_html(b, "        ", "book book-sm") for b in recent)
    s += '      </div>\n    </div>\n  </div>\n'
    note = (f"{count} book{'s' if count != 1 else ''} finished in {year} &middot; " if count else "")
    s += f'  <p class="note shelf-note">{note}<a href="{PROFILE}" rel="noopener">Full shelf on Goodreads &rarr;</a></p>\n'
    return s


def main():
    now = now_reading()
    recent, count = finished()
    if not recent:  # an empty list must never wipe the shelf
        sys.exit("books/finished.json has no books; leaving the page alone")
    page = PAGE.read_text(encoding="utf-8")
    a, b = page.find(START), page.find(END)
    if a < 0 or b < a:
        sys.exit("reading markers not found in " + str(PAGE))
    a = page.index("\n", a) + 1
    page = page[:a] + render(now, recent, count) + "  " + page[b:]
    PAGE.write_text(page, encoding="utf-8")
    keep = {p for p in re.findall(r'\.\./books/([\w.-]+\.png)', page)}
    for p in COVERS.glob("*.png"):  # drop covers that fell off the shelf
        if p.name not in keep:
            p.unlink()
    print(f"now: {len(now)}, recent: {len(recent)}, finished this year: {count}, covers kept: {len(keep)}")


if __name__ == "__main__":
    main()
