import json
import tempfile
import unittest
from pathlib import Path

import score

HERE = Path(__file__).parent / "fixtures"
START = 1760787000000


def write(tmp: Path, name: str, text: str) -> Path:
    p = tmp / name
    p.write_text(text, encoding="utf-8")
    return p


def ev(offset_s: float, kind: str = "view", package: str = "com.instagram.android") -> dict:
    t = START + round(offset_s * 1000)
    return {"package": package, "kind": kind, "itemStartMs": t, "countedAtMs": t + 1500}


class ScoreTest(unittest.TestCase):
    def setUp(self):
        self.session = score.read_labels(HERE / "sample-labels.csv")

    def test_reads_labels_with_header(self):
        self.assertEqual(self.session.package, "com.instagram.android")
        self.assertEqual([l.kind for l in self.session.labels], ["view", "skip", "view", "ad", "view", "view"])
        self.assertEqual(self.session.labels[2].t_ms, START + 6800)

    def test_sample_session_metrics(self):
        r = score.score(self.session, score.read_events(HERE / "sample-events.jsonl"))
        # labels: 4 views, 1 skip, 1 ad. Engine: views at 0.3, 7.0, 20.1, 21.0(dup), ad at 14.2; 27.0 missed.
        self.assertEqual((r.tp, r.fp, r.fn, r.dup), (3, 0, 1, 1))
        self.assertEqual(r.ad_tp, 1)
        self.assertAlmostEqual(r.recall, 0.75)
        self.assertAlmostEqual(r.dup_rate, 0.25)
        self.assertFalse(score.verdict(r))

    def test_perfect_session_passes(self):
        evs = [ev(0.1), ev(6.9), ev(14.1, "ad_view"), ev(20.0), ev(27.2)]
        r = score.score(self.session, evs)
        self.assertEqual((r.tp, r.fp, r.fn, r.dup), (4, 0, 0, 0))
        self.assertTrue(score.verdict(r))

    def test_counted_skip_is_a_false_positive(self):
        # 6.0 (skip) and 6.8 (view) are both within tolerance; nearest wins, so add an event for each.
        evs = [ev(0.0), ev(5.9), ev(6.8), ev(20.0), ev(27.0)]
        r = score.score(self.session, evs)
        self.assertEqual(r.counted_skips, 1)
        self.assertEqual(r.fp, 1)

    def test_ad_counted_as_view_is_tracked(self):
        evs = [ev(0.0), ev(6.8), ev(14.0), ev(20.0), ev(27.0)]
        r = score.score(self.session, evs)
        self.assertEqual(r.ad_as_view, 1)
        self.assertEqual(r.ad_missed, 0)

    def test_other_packages_and_out_of_window_events_are_ignored(self):
        evs = [ev(0.0), ev(6.8), ev(20.0), ev(27.0), ev(10.0, package="com.google.android.youtube"), ev(500.0)]
        r = score.score(self.session, evs)
        self.assertEqual((r.tp, r.fp), (4, 0))

    def test_align_recovers_a_clock_offset(self):
        shifted = [ev(o + 4.0) for o in (0.0, 6.8, 20.0, 27.0)] + [ev(18.0, "ad_view")]
        plain = score.score(self.session, shifted)
        aligned = score.score(self.session, shifted, align=True)
        self.assertLess(plain.tp, 4)
        self.assertEqual(aligned.tp, 4)
        self.assertEqual(aligned.offset_ms, -4000)

    def test_cli_exit_code_and_json(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            evs = write(tmp, "e.jsonl", "\n".join(json.dumps(e) for e in [ev(0.1), ev(6.9), ev(14.1, "ad_view"), ev(20.0), ev(27.2)]))
            self.assertEqual(score.main([str(evs), str(HERE / "sample-labels.csv"), "--json"]), 0)
            self.assertEqual(score.main([str(HERE / "sample-events.jsonl"), str(HERE / "sample-labels.csv")]), 1)

    def test_rejects_bad_label_files(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            with self.assertRaises(ValueError):
                score.read_labels(write(tmp, "a.csv", "offset_s,kind\n0,view\n"))
            with self.assertRaises(ValueError):
                score.read_labels(write(tmp, "b.csv", "# package=x\n# recording_start_ms=0\noffset_s,kind\n0,maybe\n"))

    def test_pooled_sums_sessions(self):
        r1 = score.score(self.session, score.read_events(HERE / "sample-events.jsonl"))
        p = score.pooled([r1, r1])
        self.assertEqual(p.tp, 2 * r1.tp)
        self.assertEqual(p.engine_views, 2 * r1.engine_views)


if __name__ == "__main__":
    unittest.main()
