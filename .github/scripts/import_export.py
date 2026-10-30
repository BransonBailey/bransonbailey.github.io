"""Convert a Goodreads library export (My Books > Import and export > Export Library) to books/finished.json.

Usage: python3 .github/scripts/import_export.py ~/Downloads/goodreads_library_export.csv

Keeps the 'read' shelf, newest Date Read first (undated books last). Covers, series overrides
and Date Read values already in finished.json are kept (the export leaves it blank for
some re-read books) for books that are still on it. The yearly count then comes from
the Date Read values, so before_tracking is reset to 0.
"""
import csv
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "books" / "finished.json"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r["Exclusive Shelf"] == "read"]
    old = {}
    if OUT.exists():
        old = {str(b["id"]): b for b in json.loads(OUT.read_text(encoding="utf-8")).get("books", [])}
    books = []
    for r in rows:
        b = {"id": r["Book Id"], "title": r["Title"], "author": r["Author"]}
        prev = old.get(r["Book Id"], {})
        read = r["Date Read"].replace("/", "-") or prev.get("read")  # the export drops dates on re-read books
        if read:
            b["read"] = read
        b.update({k: prev[k] for k in ("series", "cover") if prev.get(k)})
        if prev.get("title"):  # keep hand-edited titles (e.g. series already split out)
            b["title"] = prev["title"]
        books.append(b)
    books.sort(key=lambda b: b.get("read", ""), reverse=True)  # undated last
    OUT.write_text(json.dumps({"before_tracking": 0, "books": books}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(books)} books ({sum('read' in b for b in books)} dated) to {OUT}")


if __name__ == "__main__":
    main()
