"""Turns the downloaded JPG photos into the WebP files the app serves: <name>.webp (1280 px wide), plus
<name>-960.webp and <name>-640.webp so phones download a smaller copy, then deletes the JPG.
scripts/fetch_photos.sh runs it automatically."""
from pathlib import Path

from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "frontend/public/images/photos"
before = big = small = 0
for jpg in sorted(DIR.glob("*.jpg")):
    img = Image.open(jpg).convert("RGB")
    before += jpg.stat().st_size
    for width, suffix in ((1280, ""), (960, "-960"), (640, "-640")):
        im = img if img.width <= width else img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
        out = DIR / f"{jpg.stem}{suffix}.webp"
        im.save(out, "WEBP", quality=72, method=6)
        if suffix:
            small += out.stat().st_size
        else:
            big += out.stat().st_size
for jpg in DIR.glob("*.jpg"):
    jpg.unlink()
print(f"JPG {before / 1e6:.1f} MB -> WebP {big / 1e6:.1f} MB (full size), {small / 1e6:.1f} MB (smaller copies for phones)")
