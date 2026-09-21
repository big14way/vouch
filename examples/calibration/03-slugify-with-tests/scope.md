# Scope: slugify function with tests

Deliver two Python files, standard library only, Python 3.11+:

1. `slugify.py` exporting `slugify(text: str, max_length: int = 60) -> str` that:
   - lowercases the text and strips accents from Latin characters (`Crème Brûlée` becomes `creme-brulee`);
   - replaces every run of characters that is not `a-z` or `0-9` with a single hyphen;
   - has no leading or trailing hyphens;
   - never exceeds `max_length` characters and never cuts in the middle of a word when a hyphen is available to cut at.
2. `test_slugify.py` using `unittest`, with at least six test cases covering accents, punctuation, repeated whitespace, the empty string, the length cap, and numbers.

Type hints on the public function. A docstring on the public function. No third-party packages.
