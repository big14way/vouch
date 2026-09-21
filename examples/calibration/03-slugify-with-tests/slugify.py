"""URL-safe slugs from arbitrary text. Standard library only."""

from __future__ import annotations

import re
import unicodedata

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(text: str, max_length: int = 60) -> str:
    """Return a lowercase ASCII slug for ``text``.

    Accents on Latin characters are stripped, every run of characters outside ``a-z`` and ``0-9`` becomes a single
    hyphen, and the result has no leading or trailing hyphens. The slug never exceeds ``max_length`` characters and is
    cut at the last hyphen inside the limit when there is one, so a word is not split when it can be avoided.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")
    slug = _NON_ALNUM.sub("-", ascii_only.lower()).strip("-")
    if len(slug) <= max_length:
        return slug
    window = slug[: max_length + 1]
    cut = window.rfind("-")
    if cut > 0:
        return slug[:cut].rstrip("-")
    return slug[:max_length].rstrip("-")
