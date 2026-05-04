"""
Подбор существующего activity_type по расстоянию Дамерау–Левенштейна (OSA)
к именам в БД + проверка основы слова (Snowball / Porter2).

Используется optimal string alignment (ограниченное DL): соседняя перестановка
двух символов считается одной операцией; не пересекающиеся транспозиции
(как в «полном» DL) здесь не моделируются — для коротких имён активностей
это обычно совпадает с rapidfuzz DamerauLevenshtein.
"""

from __future__ import annotations

import re

import snowballstemmer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity_type import ActivityType
from app.services.activity_normalize import known_activity_slugs, normalize_activity_key

_STEMMER = snowballstemmer.stemmer("english")
_WORD_RE = re.compile(r"[a-z]+")


def _stem_key(key: str) -> str:
    """
    Нормализованная «основа» строки:
    eating -> eat, reading -> read, elating -> elat.
    Для multi-word строк стеммим каждое слово.
    """
    words = _WORD_RE.findall((key or "").lower())
    if not words:
        return (key or "").lower()
    return " ".join(_STEMMER.stemWord(w) for w in words)


def damerau_levenshtein_osa(a: str, b: str) -> int:
    """Расстояние Дамерау–Левенштейна (optimal string alignment), целое ≥ 0."""
    la, lb = len(a), len(b)
    if la == 0:
        return lb
    if lb == 0:
        return la
    dp = [[0] * (lb + 1) for _ in range(la + 1)]
    for i in range(la + 1):
        dp[i][0] = i
    for j in range(lb + 1):
        dp[0][j] = j
    for i in range(1, la + 1):
        for j in range(1, lb + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
            if i >= 2 and j >= 2 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                dp[i][j] = min(dp[i][j], dp[i - 2][j - 2] + 1)
    return dp[la][lb]


def _max_damerau_threshold(query_key: str) -> int:
    """
    Макс. допустимое расстояние (OSA).
    Очень короткие слова — жёстко (меньше ложных merge вроде run/fun).
    """
    n = len(query_key)
    if n <= 2:
        return 0
    if n <= 4:
        return 1
    # Для длинных слов держим жёсткий порог, иначе много ложных склеек.
    return 2


def best_fuzzy_activity_slug(raw: str) -> str | None:
    """
    Известный canonical slug с минимальным Damerau-Levenshtein (OSA).
    Используется для опечаток до создания строки в БД: rdie -> ride.
    """
    k = normalize_activity_key(raw)
    if not k or k == "—":
        return None
    threshold = _max_damerau_threshold(k)
    best: str | None = None
    best_key: tuple[int, int] | None = None
    for slug in known_activity_slugs():
        d = damerau_levenshtein_osa(k, slug)
        if d > threshold:
            continue
        tie = (d, len(slug))
        if best_key is None or tie < best_key:
            best_key = tie
            best = slug
    return best


def best_fuzzy_activity_type(db: Session, raw: str) -> ActivityType | None:
    """
    Существующий тип с минимальным Damerau–Levenshtein (OSA), если dist ≤ порога.
    При равной дистанции: dataset раньше user, короче имя, меньший id.
    """
    k = normalize_activity_key(raw)
    if not k or k == "—":
        return None
    k_stem = _stem_key(k)
    threshold = _max_damerau_threshold(k)
    rows = list(db.scalars(select(ActivityType).order_by(ActivityType.id)).all())
    best: ActivityType | None = None
    best_key: tuple[int, int, int, int, int] | None = None
    for r in rows:
        t = normalize_activity_key(r.name)
        t_stem = _stem_key(t)
        d = damerau_levenshtein_osa(k, t)
        if d > threshold:
            continue
        stem_rank = 0 if k_stem == t_stem else 1
        src_rank = 0 if r.source == "dataset" else 1
        tie: tuple[int, int, int, int, int] = (stem_rank, d, src_rank, len(t), r.id)
        if best_key is None or tie < best_key:
            best_key = tie
            best = r
    return best
