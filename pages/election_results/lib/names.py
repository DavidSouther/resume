"""One spelling of a candidate name across MEDSL, AP, Wikipedia, and the hand entered overrides.

MEDSL writes capitals, sometimes as "LAST, FIRST", sometimes with a suffix after a comma, and sometimes with mangled quotes. The normal form is
"First Middle Last Suffix" in mixed case, with a period after each bare initial and straight double quotes around a nickname.
"""

import re

SUFFIXES = {"JR": "Jr.", "SR": "Sr.", "II": "II", "III": "III", "IV": "IV", "V": "V"}
NOT_A_PERSON = ("NONE OF THESE",)  # a Nevada ballot line, which keeps its words in order


def normalize_name(name: str) -> str:
    """The normal form of `name`. Mixed case names keep their capitalization, and an empty name stays empty."""
    text = _clean(name)
    if not text:
        return ""
    shouting = not any(c.islower() for c in text)
    if "," in text and not text.upper().startswith(NOT_A_PERSON):
        head, _, tail = text.partition(",")
        if "," not in tail and _suffix(tail) is None:  # "LAST, FIRST MIDDLE" is "First Middle Last"
            text = f"{tail.strip()} {head.strip()}"
    words = text.replace(",", " ").split()
    if words and _suffix(words[-1]) is not None:
        words[-1] = _suffix(words[-1]) or words[-1]
    text = " ".join(words)
    if shouting:
        text = _title(text)
    return " ".join(_initial(w) for w in text.split())


def _clean(name: str) -> str:
    text = name.strip()
    if "â\u0080" in text:  # UTF-8 curly quotes read as Latin-1
        try:
            text = text.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    text = text.replace("\\", '"')  # a doubled quote written as a backslash and a quote
    text = re.sub(r'"{2,}', '"', text)
    if text.count('"') % 2:  # one stray quote left from that mangling
        text = text[:-1] if text.endswith('"') else text.replace('"', "", 1)
    return " ".join(text.split())


def _suffix(word: str) -> str | None:
    return SUFFIXES.get(word.strip(" ,.").upper())


def _title(text: str) -> str:
    out = re.sub(r"[^\W\d_]+", lambda m: m.group().capitalize(), text)
    out = re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), out)
    return re.sub(r"\b(Ii|Iii|Iv)\b", lambda m: m.group().upper(), out)


def _initial(word: str) -> str:
    return word + "." if len(word) == 1 and word.isupper() else word
