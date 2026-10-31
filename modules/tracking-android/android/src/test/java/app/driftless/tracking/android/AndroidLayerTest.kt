package app.driftless.tracking.android

import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.Engine
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidLayerTest {
    private val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val dbName = "test-${System.nanoTime()}.db"

    @After fun cleanup() {
        ctx.deleteDatabase(dbName)
    }

    private fun ev(id: String, seq: Int, kind: ViewKind = ViewKind.VIEW, date: String = "2026-10-18") =
        ViewEvent(id, "s1", seq, "com.instagram.android", kind, 0, 1_000L * seq, date, "Asia/Kolkata", 1, "400.0")

    @Test fun recordViewIsIdempotentAndTransactional() {
        val s = SqliteStore(ctx, dbName)
        assertTrue(s.recordView(ev("e1", 1)))
        assertFalse(s.recordView(ev("e1", 1)))
        assertFalse(s.recordView(ev("e2", 1))) // same (session, seq)
        assertTrue(s.recordView(ev("e3", 2, ViewKind.AD_VIEW)))
        val row = s.daily("2026-10-18").single()
        assertEquals(1, row.views)
        assertEquals(1, row.adViews)
        assertEquals(2, s.events(0).size)
        s.close()
    }

    @Test fun dataSurvivesReopenLikeARestart() {
        SqliteStore(ctx, dbName).apply {
            recordView(ev("e1", 1))
            addTime("2026-10-18", "com.instagram.android", 5_000, 1_000)
            close()
        }
        val s = SqliteStore(ctx, dbName)
        val row = s.daily("2026-10-18").single()
        assertEquals(1, row.views)
        assertEquals(5_000, row.surfaceMs)
        assertEquals(1_000, row.unknownMs)
        s.close()
    }

    @Test fun usageMinutesOverwriteInsteadOfAccumulating() {
        val s = SqliteStore(ctx, dbName)
        s.setUsage("2026-10-18", "com.instagram.android", 60_000)
        s.setUsage("2026-10-18", "com.instagram.android", 90_000)
        s.recordView(ev("e1", 1))
        val row = s.daily("2026-10-18").single()
        assertEquals(90_000L, row.usageMs)
        assertEquals(1, row.views)
        s.close()
    }

    @Test fun upgradesAVersion1DatabaseWithoutLosingCounts() {
        // Create the schema exactly as version 1 shipped it, with data.
        val path = ctx.getDatabasePath(dbName).apply { parentFile?.mkdirs() }
        android.database.sqlite.SQLiteDatabase.openOrCreateDatabase(path, null).use { db ->
            db.execSQL(
                """CREATE TABLE daily (local_date TEXT NOT NULL, pkg TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0,
                   ad_views INTEGER NOT NULL DEFAULT 0, surface_ms INTEGER NOT NULL DEFAULT 0,
                   unknown_ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (local_date, pkg))""",
            )
            db.execSQL("INSERT INTO daily (local_date, pkg, views) VALUES ('2026-10-01', 'com.instagram.android', 7)")
            db.execSQL("CREATE TABLE events(event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, seq INTEGER NOT NULL, pkg TEXT NOT NULL, kind TEXT NOT NULL, item_start_ms INTEGER NOT NULL, counted_at_ms INTEGER NOT NULL, local_date TEXT NOT NULL, tz TEXT NOT NULL, rule_version INTEGER NOT NULL, app_version TEXT, UNIQUE(session_id,seq))")
            db.execSQL("CREATE TABLE rings(pkg TEXT PRIMARY KEY, fps TEXT NOT NULL, saved_at INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE heartbeats(local_date TEXT NOT NULL, minute INTEGER NOT NULL, PRIMARY KEY(local_date,minute))")
            db.version = 1
        }
        val s = SqliteStore(ctx, dbName)
        val row = s.daily("2026-10-01").single()
        assertEquals(7, row.views)
        assertEquals(0L, row.usageMs)
        s.close()
    }

    @Test fun v6UpgradeRemovesDiagnosticsAndKeepsHistoryAndPendingBackup() {
        val scope = "account:a"
        SqliteStore(ctx, dbName).apply {
            val db = writableDatabase
            db.execSQL("CREATE TABLE heartbeats (scope TEXT NOT NULL, local_date TEXT NOT NULL, minute INTEGER NOT NULL, PRIMARY KEY(scope, local_date, minute))")
            for (op in listOf("INSERT", "DELETE")) db.execSQL("CREATE TRIGGER heartbeat_revision_${op.lowercase()} AFTER $op ON heartbeats BEGIN UPDATE tracking_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'; END")
            db.execSQL("INSERT INTO heartbeats VALUES (?, '2026-10-18', 600)", arrayOf(scope))
            db.execSQL("CREATE TABLE rings (scope TEXT NOT NULL, pkg TEXT NOT NULL, fps TEXT NOT NULL, saved_at INTEGER NOT NULL, PRIMARY KEY(scope, pkg))")
            db.execSQL("INSERT INTO rings VALUES (?, 'com.instagram.android', 'a,b', 1)", arrayOf(scope))
            db.execSQL("DROP TABLE synced_daily")
            db.execSQL("CREATE TABLE synced_daily (scope TEXT NOT NULL, local_date TEXT NOT NULL, device_id TEXT NOT NULL, tz TEXT NOT NULL, views INTEGER, minutes INTEGER, coverage REAL NOT NULL, rev INTEGER NOT NULL, app_views_json TEXT, PRIMARY KEY(scope, local_date, device_id))")
            db.execSQL("INSERT INTO synced_daily VALUES (?, '2026-10-18', 'phone', 'UTC', 80, 2, 0.5, 3, '{}')", arrayOf(scope))
            db.execSQL("INSERT INTO daily (scope, local_date, pkg, views, surface_ms, tz) VALUES (?, '2026-10-18', 'com.instagram.android', 7, 5000, 'UTC')", arrayOf(scope))
            db.execSQL("INSERT INTO events (scope, event_id, session_id, seq, pkg, kind, item_start_ms, counted_at_ms, local_date, tz, rule_version, app_version) VALUES (?, 'e', 's', 1, 'com.instagram.android', 'VIEW', 1, 2, '2026-10-18', 'UTC', 9, '1.2.3')", arrayOf(scope))
            db.execSQL("INSERT INTO guest_event_archive SELECT * FROM events")
            db.execSQL("INSERT INTO account_totals VALUES (?, '2026-10-18', 'com.instagram.android', 7, 5000)", arrayOf(scope))
            db.execSQL("INSERT INTO account_pending VALUES (?, '2026-10-18', 4)", arrayOf(scope))
            db.version = 6
            close()
        }
        val s = SqliteStore(ctx, dbName)
        val db = s.readableDatabase
        assertEquals(7, db.version)
        db.rawQuery("SELECT name FROM sqlite_master WHERE name IN ('heartbeats','rings','synced_daily_v6') OR name LIKE 'heartbeat_revision%'", null).use { assertEquals(0, it.count) }
        db.rawQuery("SELECT views, minutes, rev, app_views_json FROM synced_daily WHERE scope=?", arrayOf(scope)).use {
            assertTrue(it.moveToFirst())
            assertEquals(80, it.getInt(0)); assertEquals(2, it.getInt(1)); assertEquals(3, it.getInt(2)); assertEquals("{}", it.getString(3))
            assertTrue(it.getColumnIndex("coverage") == -1)
        }
        db.rawQuery("SELECT views, surface_ms FROM daily WHERE scope=?", arrayOf(scope)).use {
            assertTrue(it.moveToFirst()); assertEquals(7, it.getInt(0)); assertEquals(5000, it.getInt(1))
        }
        for (table in listOf("events", "guest_event_archive")) db.rawQuery("SELECT counted_at_ms, rule_version, app_version FROM $table WHERE scope=?", arrayOf(scope)).use {
            assertTrue(it.moveToFirst()); assertEquals(2, it.getInt(0)); assertEquals(0, it.getInt(1)); assertTrue(it.isNull(2))
        }
        db.rawQuery("SELECT rev FROM account_pending WHERE scope=? AND date='2026-10-18'", arrayOf(scope)).use {
            assertTrue(it.moveToFirst()); assertEquals(4, it.getInt(0))
        }
        db.rawQuery("SELECT views, usage_ms FROM account_totals WHERE scope=?", arrayOf(scope)).use {
            assertTrue(it.moveToFirst()); assertEquals(7, it.getInt(0)); assertEquals(5000, it.getInt(1))
        }
        s.close()
    }

    @Test fun itemIdentifiersStayInMemoryAndExpire() {
        val s = SqliteStore(ctx, dbName)
        s.saveRing("com.instagram.android", listOf("a", "b"), 100)
        assertEquals(listOf("a", "b"), s.loadRing("com.instagram.android", 200, Engine.RING_MAX_AGE_MS))
        assertEquals(emptyList<String>(), s.loadRing("com.instagram.android", Engine.RING_MAX_AGE_MS + 1_000, Engine.RING_MAX_AGE_MS))
        s.close()
        val reopened = SqliteStore(ctx, dbName)
        assertEquals(emptyList<String>(), reopened.loadRing("com.instagram.android", 200, Engine.RING_MAX_AGE_MS))
        reopened.close()
    }

    @Test fun storesNoHeartbeatsItemIdentifiersCoverageOrEventVersions() {
        val s = SqliteStore(ctx, dbName)
        s.recordView(ev("e1", 1))
        s.readableDatabase.rawQuery("SELECT name FROM sqlite_master WHERE name IN ('heartbeats','rings')", null).use {
            assertEquals(0, it.count)
        }
        s.readableDatabase.rawQuery("PRAGMA table_info(synced_daily)", null).use { c ->
            while (c.moveToNext()) assertTrue(c.getString(1) != "coverage")
        }
        s.readableDatabase.rawQuery("SELECT rule_version, app_version FROM events", null).use {
            it.moveToFirst(); assertEquals(0, it.getInt(0)); assertTrue(it.isNull(1))
        }
        s.close()
    }

    @Test fun purgeKeepsAggregatesAndDropsRawEvents() {
        val s = SqliteStore(ctx, dbName)
        s.recordView(ev("old", 1, date = "2026-09-01"))
        s.purgeOlderThan(cutoffMs = 10_000, cutoffDate = "2026-09-18")
        assertEquals(0, s.events(0).size)
        assertEquals(1, s.daily("2026-09-01").single().views)
        s.close()
    }

    @Test fun schemaHasNoColumnsForContent() {
        val s = SqliteStore(ctx, dbName)
        val cols = mutableListOf<String>()
        for (t in listOf("events", "daily")) {
            s.readableDatabase.rawQuery("PRAGMA table_info($t)", null).use { c ->
                while (c.moveToNext()) cols += c.getString(1)
            }
        }
        for (forbidden in listOf("text", "desc", "caption", "title", "url", "screenshot", "tree")) {
            assertTrue("column containing '$forbidden' found: $cols", cols.none { it.contains(forbidden) })
        }
        s.close()
    }

    @Test fun bundledRulesParseAndAreMarkedUnvalidated() {
        val rules = RulesLoader.load(ctx)
        assertEquals(setOf("com.instagram.android", "com.google.android.youtube"), rules.apps.keys)
        assertTrue(rules.apps.values.all { it.validatedVersions.isEmpty() })
        assertTrue(rules.apps.values.all { it.surfaceViewIds.isNotEmpty() && it.itemParts.isNotEmpty() })
    }

    @Test fun accessibilityConfigIsNotAnAccessibilityToolAndIsScopedToSupportedApps() {
        val xml = File("src/main/res/xml/driftless_accessibility.xml").readText()
        assertFalse("must not claim isAccessibilityTool (Play policy)", Regex("""android:isAccessibilityTool\s*=""").containsMatchIn(xml))
        assertTrue(xml.contains("""android:packageNames="com.instagram.android,com.google.android.youtube""""))
        assertTrue(xml.contains("""android:canPerformGestures="false""""))
    }

    @Test fun consentDefaultsToOff() {
        ctx.getSharedPreferences("driftless_tracking", 0).edit().clear().commit()
        val p = TrackingPrefs(ctx)
        assertFalse(p.disclosureAccepted)
        val secret = p.installSecret
        assertEquals(32, secret.size)
        assertTrue(secret.contentEquals(TrackingPrefs(ctx).installSecret))
    }

    @Test fun oldNarrowDisclosureConsentMustBeRenewedForExpandedAppScope() {
        ctx.getSharedPreferences("driftless_tracking", 0).edit()
            .putBoolean("a11y_disclosure_accepted", true)
            .putInt("a11y_disclosure_version", 1)
            .commit()
        val p = TrackingPrefs(ctx)
        assertFalse(p.disclosureAccepted)
        p.disclosureAccepted = true
        assertTrue(p.disclosureAccepted)
    }
}
