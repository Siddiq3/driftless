#!/usr/bin/env python3
"""
Score the Driftless counting engine against a hand-labelled session (gate G-2, TEST_PLAN §3).

Inputs
  events.jsonl  Exported from the app (Counter screen > "Export counted events"). One JSON object per
                line: {"package", "kind": "view"|"ad_view", "itemStartMs", "countedAtMs", ...}
  labels.csv    Written by a person watching the screen recording of the same session:

                  # package=com.instagram.android
                  # app_version=400.0.0.0
                  # recording_start_ms=1760787000000
                  offset_s,kind
                  0.0,view
                  4.2,skip
                  5.1,view
                  12.8,ad

                offset_s = seconds from the start of the recording to when a new item appeared.
                kind: view = watched >= 1.5 s (should count), skip = < 1.5 s (should NOT count),
                      ad = advertisement (should count as ad, not view).

Matching: each engine event is matched to the nearest unmatched label within --tolerance seconds
of its itemStartMs. Optionally the clock offset between phone and recording is estimated (--align).

Output: per-session and pooled precision, recall, duplicate rate and ad confusion, plus PASS/FAIL
against the G-2 thresholds. Exit code 1 if any threshold fails.

Standard library only.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

PRECISION_MIN = 0.95
RECALL_MIN = 0.90
DUP_MAX = 0.01


@dataclass
class Label:
    t_ms: int
    kind: str  # view | skip | ad
    matched: bool = False


@dataclass
class Session:
    name: str
    package: str
    app_version: str
    labels: list[Label]


@dataclass
class Result:
    name: str
    package: str
    app_version: str
    tp: int = 0
    fp: int = 0
    fn: int = 0
    dup: int = 0
    counted_skips: int = 0
    ad_as_view: int = 0
    ad_tp: int = 0
    ad_missed: int = 0
    engine_views: int = 0
    offset_ms: int = 0
    residual_ms: int = 0  # summed |engine - label| over matches; used to choose the alignment
    notes: list[str] = field(default_factory=list)

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 1.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 1.0

    @property
    def dup_rate(self) -> float:
        return self.dup / self.engine_views if self.engine_views else 0.0


def read_labels(path: Path) -> Session:
    meta: dict[str, str] = {}
    rows: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#"):
            k, _, v = s[1:].partition("=")
            meta[k.strip()] = v.strip()
        else:
            rows.append(s)
    for key in ("package", "recording_start_ms"):
        if key not in meta:
            raise ValueError(f"{path}: missing '# {key}=' header")
    start = int(meta["recording_start_ms"])
    labels = []
    for r in csv.DictReader(rows):
        kind = r["kind"].strip().lower()
        if kind not in ("view", "skip", "ad"):
            raise ValueError(f"{path}: unknown kind {kind!r}")
        labels.append(Label(start + round(float(r["offset_s"]) * 1000), kind))
    labels.sort(key=lambda l: l.t_ms)
    return Session(path.stem, meta["package"], meta.get("app_version", "?"), labels)


def read_events(path: Path) -> list[dict]:
    out = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            e = json.loads(line)
            for k in ("package", "kind", "itemStartMs"):
                if k not in e:
                    raise ValueError(f"{path}:{i}: missing {k}")
            out.append(e)
    return out


def _match(session: Session, events: list[dict], offset_ms: int, tol_ms: int) -> Result:
    labels = [Label(l.t_ms, l.kind) for l in session.labels]
    res = Result(session.name, session.package, session.app_version, offset_ms=offset_ms)
    lo = labels[0].t_ms - tol_ms if labels else 0
    hi = labels[-1].t_ms + tol_ms if labels else 0
    evs = sorted(
        (e for e in events if e["package"] == session.package and lo <= e["itemStartMs"] + offset_ms <= hi),
        key=lambda e: e["itemStartMs"],
    )
    for e in evs:
        t = e["itemStartMs"] + offset_ms
        is_ad = e["kind"] == "ad_view"
        if not is_ad:
            res.engine_views += 1
        near = [l for l in labels if abs(l.t_ms - t) <= tol_ms]
        free = [l for l in near if not l.matched]
        if not free:
            if near and not is_ad:
                res.dup += 1  # a second count for an item that was already counted
            elif not is_ad:
                res.fp += 1
            continue
        best = min(free, key=lambda l: abs(l.t_ms - t))
        best.matched = True
        res.residual_ms += abs(best.t_ms - t)
        if is_ad:
            if best.kind == "ad":
                res.ad_tp += 1
        elif best.kind == "view":
            res.tp += 1
        elif best.kind == "skip":
            res.fp += 1
            res.counted_skips += 1
        elif best.kind == "ad":
            res.fp += 1
            res.ad_as_view += 1
    for l in labels:
        if not l.matched and l.kind == "view":
            res.fn += 1
        if not l.matched and l.kind == "ad":
            res.ad_missed += 1
    return res


def score(session: Session, events: list[dict], tol_s: float = 2.5, align: bool = False) -> Result:
    tol_ms = round(tol_s * 1000)
    if not align:
        return _match(session, events, 0, tol_ms)
    # Search a clock offset in ±10 s (250 ms steps): most correct matches first, then tightest fit.
    best = None
    for off in range(-10_000, 10_001, 250):
        r = _match(session, events, off, tol_ms)
        key = (r.tp + r.ad_tp - r.fp - r.dup, -r.residual_ms, -abs(off))
        if best is None or key > best[0]:
            best = (key, r)
    return best[1]


def pooled(results: list[Result]) -> Result:
    p = Result("POOLED", ",".join(sorted({r.package for r in results})), "-")
    for r in results:
        for f in ("tp", "fp", "fn", "dup", "counted_skips", "ad_as_view", "ad_tp", "ad_missed", "engine_views"):
            setattr(p, f, getattr(p, f) + getattr(r, f))
    return p


def verdict(r: Result) -> bool:
    return r.precision >= PRECISION_MIN and r.recall >= RECALL_MIN and r.dup_rate <= DUP_MAX


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("events", type=Path)
    ap.add_argument("labels", type=Path, nargs="+")
    ap.add_argument("--tolerance", type=float, default=2.5, help="match window in seconds (default 2.5)")
    ap.add_argument("--align", action="store_true", help="estimate phone/recording clock offset")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    a = ap.parse_args(argv)

    events = read_events(a.events)
    results = [score(read_labels(p), events, a.tolerance, a.align) for p in a.labels]
    allr = results + ([pooled(results)] if len(results) > 1 else [])
    ok = all(verdict(r) for r in allr)

    if a.json:
        print(json.dumps([
            {"session": r.name, "package": r.package, "appVersion": r.app_version, "precision": round(r.precision, 4),
             "recall": round(r.recall, 4), "dupRate": round(r.dup_rate, 4), "tp": r.tp, "fp": r.fp, "fn": r.fn,
             "dup": r.dup, "countedSkips": r.counted_skips, "adAsView": r.ad_as_view, "adTp": r.ad_tp,
             "adMissed": r.ad_missed, "offsetMs": r.offset_ms, "pass": verdict(r)} for r in allr
        ], indent=2))
    else:
        print(f"{'session':<24}{'app':<28}{'P':>7}{'R':>7}{'dup':>7}  TP/FP/FN  skips ads(ok/asView/miss)  verdict")
        for r in allr:
            print(f"{r.name:<24}{r.package + ' ' + r.app_version:<28}{r.precision:>7.3f}{r.recall:>7.3f}{r.dup_rate:>7.3f}"
                  f"  {r.tp}/{r.fp}/{r.fn}  {r.counted_skips:>5}  {r.ad_tp}/{r.ad_as_view}/{r.ad_missed}"
                  f"  {'PASS' if verdict(r) else 'FAIL'}")
        print(f"\nG-2 thresholds: precision >= {PRECISION_MIN}, recall >= {RECALL_MIN}, duplicates <= {DUP_MAX}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
