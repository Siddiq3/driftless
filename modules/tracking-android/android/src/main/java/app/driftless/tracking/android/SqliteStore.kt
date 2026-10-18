package app.driftless.tracking.android

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import app.driftless.tracking.core.DailyRow
import app.driftless.tracking.core.TrackingStore
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind

/**
 * Native source of truth for counts (D-008). Holds only counter-grade data: event ids, timestamps,
 * package, kind, salted item codes in the ring buffer. Never node text, trees or screenshots.
 * Excluded from cloud backup via the app's allowBackup=false.
 */
class SqliteStore(context: Context, name: String? = DB_NAME) :
    SQLiteOpenHelper(context.applicationContext, name, null, SCHEMA_VERSION),
    TrackingStore {

    override fun onConfigure(db: SQLiteDatabase) {
        db.enableWriteAheadLogging()
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE events (
                 event_id TEXT PRIMARY KEY NOT NULL,
                 session_id TEXT NOT NULL,
                 seq INTEGER NOT NULL,
                 pkg TEXT NOT NULL,
                 kind TEXT NOT NULL,
                 item_start_ms INTEGER NOT NULL,
                 counted_at_ms INTEGER NOT NULL,
                 local_date TEXT NOT NULL,
                 tz TEXT NOT NULL,
                 rule_version INTEGER NOT NULL,
                 app_version TEXT,
                 UNIQUE (session_id, seq))""",
        )
        db.execSQL("CREATE INDEX events_counted_at ON events (counted_at_ms)")
        db.execSQL(
            """CREATE TABLE daily (
                 local_date TEXT NOT NULL,
                 pkg TEXT NOT NULL,
                 views INTEGER NOT NULL DEFAULT 0,
                 ad_views INTEGER NOT NULL DEFAULT 0,
                 surface_ms INTEGER NOT NULL DEFAULT 0,
                 unknown_ms INTEGER NOT NULL DEFAULT 0,
                 PRIMARY KEY (local_date, pkg))""",
        )
        db.execSQL("CREATE TABLE rings (pkg TEXT PRIMARY KEY NOT NULL, fps TEXT NOT NULL, saved_at INTEGER NOT NULL)")
        db.execSQL(
            "CREATE TABLE heartbeats (local_date TEXT NOT NULL, minute INTEGER NOT NULL, PRIMARY KEY (local_date, minute))",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Forward-only migrations go here. Never drop user aggregates.
    }

    private fun ensureDaily(db: SQLiteDatabase, date: String, pkg: String) {
        db.execSQL("INSERT OR IGNORE INTO daily (local_date, pkg) VALUES (?, ?)", arrayOf(date, pkg))
    }

    override fun recordView(e: ViewEvent): Boolean {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val v = ContentValues().apply {
                put("event_id", e.eventId)
                put("session_id", e.sessionId)
                put("seq", e.seq)
                put("pkg", e.pkg)
                put("kind", e.kind.name)
                put("item_start_ms", e.itemStartMs)
                put("counted_at_ms", e.countedAtMs)
                put("local_date", e.localDate)
                put("tz", e.tz)
                put("rule_version", e.ruleVersion)
                put("app_version", e.appVersion)
            }
            val row = db.insertWithOnConflict("events", null, v, SQLiteDatabase.CONFLICT_IGNORE)
            if (row == -1L) return false // duplicate event_id or (session_id, seq): already counted
            ensureDaily(db, e.localDate, e.pkg)
            val col = if (e.kind == ViewKind.VIEW) "views" else "ad_views"
            db.execSQL("UPDATE daily SET $col = $col + 1 WHERE local_date = ? AND pkg = ?", arrayOf(e.localDate, e.pkg))
            db.setTransactionSuccessful()
            return true
        } finally {
            db.endTransaction()
        }
    }

    override fun addTime(localDate: String, pkg: String, surfaceMs: Long, unknownMs: Long) {
        if (surfaceMs == 0L && unknownMs == 0L) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            ensureDaily(db, localDate, pkg)
            db.execSQL(
                "UPDATE daily SET surface_ms = surface_ms + ?, unknown_ms = unknown_ms + ? WHERE local_date = ? AND pkg = ?",
                arrayOf(surfaceMs, unknownMs, localDate, pkg),
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    override fun saveRing(pkg: String, ring: List<String>, savedAtMs: Long) {
        writableDatabase.execSQL(
            "INSERT OR REPLACE INTO rings (pkg, fps, saved_at) VALUES (?, ?, ?)",
            arrayOf(pkg, ring.joinToString(","), savedAtMs),
        )
    }

    override fun loadRing(pkg: String, nowMs: Long, maxAgeMs: Long): List<String> =
        readableDatabase.rawQuery("SELECT fps, saved_at FROM rings WHERE pkg = ?", arrayOf(pkg)).use { c ->
            if (!c.moveToFirst() || nowMs - c.getLong(1) > maxAgeMs) emptyList()
            else c.getString(0).split(',').filter { it.isNotEmpty() }
        }

    override fun heartbeat(localDate: String, minuteOfDay: Int) {
        writableDatabase.execSQL(
            "INSERT OR IGNORE INTO heartbeats (local_date, minute) VALUES (?, ?)",
            arrayOf(localDate, minuteOfDay),
        )
    }

    override fun heartbeatMinutes(localDate: String): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM heartbeats WHERE local_date = ?", arrayOf(localDate)).use {
            it.moveToFirst()
            it.getInt(0)
        }

    override fun daily(localDate: String): List<DailyRow> =
        readableDatabase.rawQuery(
            "SELECT local_date, pkg, views, ad_views, surface_ms, unknown_ms FROM daily WHERE local_date = ? ORDER BY pkg",
            arrayOf(localDate),
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(DailyRow(c.getString(0), c.getString(1), c.getInt(2), c.getInt(3), c.getLong(4), c.getLong(5)))
            }
        }

    override fun events(sinceMs: Long): List<ViewEvent> =
        readableDatabase.rawQuery(
            """SELECT event_id, session_id, seq, pkg, kind, item_start_ms, counted_at_ms, local_date, tz, rule_version, app_version
               FROM events WHERE counted_at_ms >= ? ORDER BY counted_at_ms""",
            arrayOf(sinceMs.toString()),
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(
                        ViewEvent(
                            c.getString(0), c.getString(1), c.getInt(2), c.getString(3), ViewKind.valueOf(c.getString(4)),
                            c.getLong(5), c.getLong(6), c.getString(7), c.getString(8), c.getInt(9),
                            if (c.isNull(10)) null else c.getString(10),
                        ),
                    )
                }
            }
        }

    /** Raw events and heartbeats are kept 30 days; daily aggregates until the user wipes them. */
    fun purgeOlderThan(cutoffMs: Long, cutoffDate: String) {
        writableDatabase.execSQL("DELETE FROM events WHERE counted_at_ms < ?", arrayOf(cutoffMs))
        writableDatabase.execSQL("DELETE FROM heartbeats WHERE local_date < ?", arrayOf(cutoffDate))
    }

    fun wipeAll() {
        val db = writableDatabase
        for (t in listOf("events", "daily", "rings", "heartbeats")) db.execSQL("DELETE FROM $t")
    }

    companion object {
        const val DB_NAME = "driftless_tracking.db"
        const val SCHEMA_VERSION = 1

        @Volatile private var instance: SqliteStore? = null

        fun get(context: Context): SqliteStore =
            instance ?: synchronized(this) { instance ?: SqliteStore(context).also { instance = it } }
    }
}
