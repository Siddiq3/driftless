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
            saveRing("com.instagram.android", listOf("a", "b"), 100)
            heartbeat("2026-10-18", 600)
            close()
        }
        val s = SqliteStore(ctx, dbName)
        val row = s.daily("2026-10-18").single()
        assertEquals(1, row.views)
        assertEquals(5_000, row.surfaceMs)
        assertEquals(1_000, row.unknownMs)
        assertEquals(listOf("a", "b"), s.loadRing("com.instagram.android", 200, Engine.RING_MAX_AGE_MS))
        assertEquals(emptyList<String>(), s.loadRing("com.instagram.android", Engine.RING_MAX_AGE_MS + 1_000, Engine.RING_MAX_AGE_MS))
        assertEquals(1, s.heartbeatMinutes("2026-10-18"))
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
            db.version = 1
        }
        val s = SqliteStore(ctx, dbName)
        val row = s.daily("2026-10-01").single()
        assertEquals(7, row.views)
        assertEquals(0L, row.usageMs)
        s.close()
    }

    @Test fun purgeKeepsAggregatesAndDropsRawEvents() {
        val s = SqliteStore(ctx, dbName)
        s.recordView(ev("old", 1, date = "2026-09-01"))
        s.heartbeat("2026-09-01", 1)
        s.purgeOlderThan(cutoffMs = 10_000, cutoffDate = "2026-09-18")
        assertEquals(0, s.events(0).size)
        assertEquals(0, s.heartbeatMinutes("2026-09-01"))
        assertEquals(1, s.daily("2026-09-01").single().views)
        s.close()
    }

    @Test fun schemaHasNoColumnsForContent() {
        val s = SqliteStore(ctx, dbName)
        val cols = mutableListOf<String>()
        for (t in listOf("events", "daily", "rings", "heartbeats")) {
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
}
