import unittest

from slugify import slugify


class SlugifyTests(unittest.TestCase):
    def test_accents_are_stripped(self) -> None:
        self.assertEqual(slugify("Crème Brûlée"), "creme-brulee")

    def test_punctuation_collapses_to_single_hyphen(self) -> None:
        self.assertEqual(slugify("Hello, World! -- again"), "hello-world-again")

    def test_repeated_whitespace(self) -> None:
        self.assertEqual(slugify("  many    spaces\there  "), "many-spaces-here")

    def test_empty_string(self) -> None:
        self.assertEqual(slugify(""), "")

    def test_numbers_are_kept(self) -> None:
        self.assertEqual(slugify("50% off in 2024"), "50-off-in-2024")

    def test_length_cap_does_not_split_a_word(self) -> None:
        words = " ".join(["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo"])
        slug = slugify(words, max_length=30)
        self.assertLessEqual(len(slug), 30)
        self.assertFalse(slug.endswith("-"))
        self.assertIn(slug.split("-")[-1], words.split(" "))

    def test_single_long_word_is_hard_cut(self) -> None:
        self.assertEqual(slugify("a" * 80, max_length=10), "a" * 10)

    def test_idempotent(self) -> None:
        once = slugify("Déjà vu, again & again")
        self.assertEqual(slugify(once), once)


if __name__ == "__main__":
    unittest.main()
