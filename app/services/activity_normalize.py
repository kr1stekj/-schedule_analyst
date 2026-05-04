"""
Семантические группы типов занятий (синонимы + формы слова) и каноническое имя для новых строк.
Регистр/опечатки вне этих групп — в activity_fuzzy (Дамерау–Левенштейн).
"""

from __future__ import annotations

import re

# Ключ группы → имя новой строки в БД, если типа ещё нет
_SLUG_DISPLAY: dict[str, str] = {
    "sleep": "Sleep",
    "work": "Work",
    "eat": "Eat",
    "relax": "Relax",
    "shop": "Shop",
    "social": "Socialize",
    "exercise": "Exercise",
    "clean": "Clean",
    "cook": "Cook",
    "drive": "Drive",
    "ride": "Ride",
    "walk": "Walk",
    "read": "Read",
    "run": "Run",
    "study": "Study",
}

# Ключ → нижние варианты одного типа (смысл + морфология; то, что fuzzy по буквам не склеит)
_SLUG_VARIANTS: dict[str, set[str]] = {
    "sleep": {"sleep", "sleeps", "sleeping", "slept"},
    "work": {"work", "works", "working", "worked"},
    "eat": {"eat", "eats", "eating", "ate", "meal", "meals"},
    "relax": {"relax", "relaxing", "relaxed", "relaxation"},
    "shop": {"shop", "shopping", "shopped"},
    "social": {"social", "socializing", "socialise", "socialized"},
    "exercise": {"exercise", "exercising", "exercises", "gym", "workout"},
    "clean": {"clean", "cleaning", "cleans", "cleansed"},
    "cook": {"cook", "cooking", "cooks", "cooked"},
    "drive": {"drive", "drives", "driving", "drove"},
    "ride": {"ride", "rides", "riding", "rode"},
    "walk": {"walk", "walks", "walking", "walked"},
    "read": {"read", "reads", "reading"},
    "run": {"run", "runs", "running", "ran"},
    "study": {"study", "studies", "studying", "studied"},
}


def _collapse_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()


def normalize_activity_key(s: str) -> str:
    """Сравнение строк активности (регистр, пробелы)."""
    return _collapse_ws(s)


def known_activity_slugs() -> tuple[str, ...]:
    """Канонические ключи известных групп активностей."""
    return tuple(_SLUG_DISPLAY)


def _slug_from_gerund(k: str) -> str | None:
    """
    driving → drive, running → run, eating → eat (если корень уже в какой-либо группе).
    Не трогаем короткие слова вроде sing (len < 5 после снятия ing).
    """
    if not k.endswith("ing") or len(k) < 5:
        return None
    stem = k[:-3]
    if not stem:
        return None
    bases = [stem, stem + "e"]
    if len(stem) >= 2 and stem[-1] == stem[-2]:
        bases.append(stem[:-1])
    for slug, variants in _SLUG_VARIANTS.items():
        for b in bases:
            if b in variants:
                return slug
    return None


def canonical_slug(raw: str) -> str:
    """Внутренний ключ группы; для неизвестных слов — нормализованная строка."""
    k = _collapse_ws(raw)
    if not k:
        return "—"
    for slug, variants in _SLUG_VARIANTS.items():
        if k in variants:
            return slug
    g = _slug_from_gerund(k)
    if g is not None:
        return g
    return k


def variant_set_for_slug(slug: str) -> set[str]:
    """Множество lower()-строк, которые должны попасть в один тип."""
    if slug in _SLUG_VARIANTS:
        out = set(_SLUG_VARIANTS[slug])
        out.add(slug)
        return out
    return {slug}


def display_name_for_new_row(raw: str, slug: str) -> str:
    """Имя новой строки activity_types (если в БД ещё ничего не нашли)."""
    if slug in _SLUG_DISPLAY:
        return _SLUG_DISPLAY[slug]
    base = (raw or "").strip() or "—"
    if len(base) > 128:
        base = base[:128]
    # title case по словам
    return " ".join(w[:1].upper() + w[1:].lower() if w else w for w in base.split())
