package app.driftless.tracking.android

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import app.driftless.tracking.core.DailyRow
import app.driftless.tracking.core.TrackingStore
import app.driftless.tracking.core.ViewEvent
import app.driftless.tracking.core.ViewKind
import java.util.UUID
import java.time.ZoneId
import org.json.JSONArray
import app.driftless.tracking.core.UsageMath

/**
 * Native source of truth for counts (D-008). Holds only counter-grade data: event ids, timestamps,
 * package, kind, salted item codes in the ring buffer. Never node text, trees or screenshots.
 * Excluded from cloud backup via the app's allowBackup=false.
 */
class SqliteStore(context: Context, name: String? = DB_NAME) :
    SQLiteOpenHelper(context.applicationContext, name, null, SCHEMA_VERSION),
    TrackingStore {

    private val appContext = context.applicationContext
    private val capturedScope = ThreadLocal<String?>()

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
                 usage_ms INTEGER NOT NULL DEFAULT 0,
                 PRIMARY KEY (local_date, pkg))""",
        )
        db.execSQL("CREATE TABLE rings (pkg TEXT PRIMARY KEY NOT NULL, fps TEXT NOT NULL, saved_at INTEGER NOT NULL)")
        db.execSQL(
            "CREATE TABLE heartbeats (local_date TEXT NOT NULL, minute INTEGER NOT NULL, PRIMARY KEY (local_date, minute))",
        )
        migrateScopes(db, fresh = true)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Forward-only migrations. Never drop user aggregates.
        if (oldVersion < 2) db.execSQL("ALTER TABLE daily ADD COLUMN usage_ms INTEGER NOT NULL DEFAULT 0")
        if (oldVersion < 3) migrateScopes(db, fresh = false)
    }

    private fun ensureDaily(db: SQLiteDatabase, date: String, pkg: String) {
        db.execSQL("INSERT OR IGNORE INTO daily (scope, local_date, pkg, tz) VALUES (?, ?, ?, ?)", arrayOf(activeScope(), date, pkg, ZoneId.systemDefault().id))
    }

    @Synchronized
    override fun recordView(e: ViewEvent): Boolean {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val v = ContentValues().apply {
                put("scope", activeScope())
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
            db.execSQL("UPDATE daily SET $col = $col + 1, tz = ?, status = CASE WHEN status = 'experimental' OR ? = 0 THEN 'experimental' ELSE 'validated' END WHERE scope = ? AND local_date = ? AND pkg = ?", arrayOf(e.tz, if (RulesLoader.load(appContext).apps[e.pkg]?.let { app.driftless.tracking.core.isValidatedVersion(it, e.appVersion) } == true) 1 else 0, activeScope(), e.localDate, e.pkg))
            db.setTransactionSuccessful()
            return true
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    override fun addTime(localDate: String, pkg: String, surfaceMs: Long, unknownMs: Long) {
        if (surfaceMs == 0L && unknownMs == 0L) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            ensureDaily(db, localDate, pkg)
            db.execSQL(
                "UPDATE daily SET surface_ms = surface_ms + ?, unknown_ms = unknown_ms + ? WHERE scope = ? AND local_date = ? AND pkg = ?",
                arrayOf<Any>(surfaceMs, unknownMs, activeScope(), localDate, pkg),
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    override fun setUsage(localDate: String, pkg: String, usageMs: Long) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            ensureDaily(db, localDate, pkg)
            db.execSQL("UPDATE daily SET usage_ms = ?, usage_observed = 1 WHERE scope = ? AND local_date = ? AND pkg = ? AND (usage_ms != ? OR usage_observed = 0)", arrayOf<Any>(usageMs, activeScope(), localDate, pkg, usageMs))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    override fun saveRing(pkg: String, ring: List<String>, savedAtMs: Long) {
        writableDatabase.execSQL(
            "INSERT OR REPLACE INTO rings (scope, pkg, fps, saved_at) VALUES (?, ?, ?, ?)",
            arrayOf<Any>(activeScope(), pkg, ring.joinToString(","), savedAtMs),
        )
    }

    @Synchronized
    override fun loadRing(pkg: String, nowMs: Long, maxAgeMs: Long): List<String> =
        readableDatabase.rawQuery("SELECT fps, saved_at FROM rings WHERE scope = ? AND pkg = ?", arrayOf(activeScope(), pkg)).use { c ->
            if (!c.moveToFirst() || nowMs - c.getLong(1) > maxAgeMs) emptyList()
            else c.getString(0).split(',').filter { it.isNotEmpty() }
        }

    @Synchronized
    override fun heartbeat(localDate: String, minuteOfDay: Int) {
        writableDatabase.execSQL(
            "INSERT OR IGNORE INTO heartbeats (scope, local_date, minute) VALUES (?, ?, ?)",
            arrayOf<Any>(activeScope(), localDate, minuteOfDay),
        )
    }

    @Synchronized
    override fun heartbeatMinutes(localDate: String): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM heartbeats WHERE scope = ? AND local_date = ?", arrayOf(activeScope(), localDate)).use {
            it.moveToFirst()
            it.getInt(0)
        }

    @Synchronized
    override fun daily(localDate: String): List<DailyRow> =
        readableDatabase.rawQuery(
            "SELECT local_date, pkg, views, ad_views, surface_ms, unknown_ms, usage_ms FROM daily WHERE scope = ? AND local_date = ? ORDER BY pkg",
            arrayOf(activeScope(), localDate),
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(DailyRow(c.getString(0), c.getString(1), c.getInt(2), c.getInt(3), c.getLong(4), c.getLong(5), c.getLong(6)))
            }
        }

    /** Enumerate retained aggregate dates without replaying or recomputing historical events. */
    @Synchronized
    fun storedDates(from: String, to: String): List<String> =
        readableDatabase.rawQuery(
            "SELECT DISTINCT local_date FROM daily WHERE scope = ? AND local_date BETWEEN ? AND ? ORDER BY local_date LIMIT 400",
            arrayOf(activeScope(), from, to),
        ).use { c -> buildList { while (c.moveToNext()) add(c.getString(0)) } }

    @Synchronized
    override fun events(sinceMs: Long): List<ViewEvent> =
        readableDatabase.rawQuery(
            """SELECT event_id, session_id, seq, pkg, kind, item_start_ms, counted_at_ms, local_date, tz, rule_version, app_version
               FROM events WHERE scope = ? AND counted_at_ms >= ? ORDER BY counted_at_ms""",
            arrayOf(activeScope(), sinceMs.toString()),
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
        writableDatabase.execSQL("DELETE FROM events WHERE counted_at_ms < ?", arrayOf<Any>(cutoffMs))
        writableDatabase.execSQL("DELETE FROM heartbeats WHERE local_date < ?", arrayOf(cutoffDate))
    }

    @Synchronized
    fun wipeAll() {
        val db = writableDatabase
        for (t in listOf("events", "daily", "rings", "heartbeats", "synced_daily")) db.execSQL("DELETE FROM $t")
    }

    private fun migrateScopes(db: SQLiteDatabase, fresh: Boolean) {
        db.execSQL("ALTER TABLE events ADD COLUMN scope TEXT NOT NULL DEFAULT 'legacy'")
        db.execSQL("CREATE INDEX events_scope_time ON events(scope, counted_at_ms)")
        db.execSQL("CREATE TABLE daily_scoped (scope TEXT NOT NULL, local_date TEXT NOT NULL, pkg TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, ad_views INTEGER NOT NULL DEFAULT 0, surface_ms INTEGER NOT NULL DEFAULT 0, unknown_ms INTEGER NOT NULL DEFAULT 0, usage_ms INTEGER NOT NULL DEFAULT 0, tz TEXT NOT NULL DEFAULT 'UTC', status TEXT NOT NULL DEFAULT 'unknown', usage_observed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(scope, local_date, pkg))")
        db.execSQL("INSERT INTO daily_scoped(scope, local_date, pkg, views, ad_views, surface_ms, unknown_ms, usage_ms, usage_observed) SELECT 'legacy', local_date, pkg, views, ad_views, surface_ms, unknown_ms, usage_ms, CASE WHEN usage_ms > 0 THEN 1 ELSE 0 END FROM daily")
        db.execSQL("DROP TABLE daily")
        db.execSQL("ALTER TABLE daily_scoped RENAME TO daily")
        db.execSQL("ALTER TABLE rings RENAME TO rings_legacy")
        db.execSQL("CREATE TABLE rings (scope TEXT NOT NULL, pkg TEXT NOT NULL, fps TEXT NOT NULL, saved_at INTEGER NOT NULL, PRIMARY KEY(scope, pkg))")
        db.execSQL("INSERT INTO rings SELECT 'legacy', pkg, fps, saved_at FROM rings_legacy")
        db.execSQL("DROP TABLE rings_legacy")
        db.execSQL("ALTER TABLE heartbeats RENAME TO heartbeats_legacy")
        db.execSQL("CREATE TABLE heartbeats (scope TEXT NOT NULL, local_date TEXT NOT NULL, minute INTEGER NOT NULL, PRIMARY KEY(scope, local_date, minute))")
        db.execSQL("INSERT INTO heartbeats SELECT 'legacy', local_date, minute FROM heartbeats_legacy")
        db.execSQL("DROP TABLE heartbeats_legacy")
        db.execSQL("CREATE TABLE tracking_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)")
        db.execSQL("CREATE TABLE scope_bindings (source TEXT PRIMARY KEY NOT NULL, target TEXT NOT NULL)")
        db.execSQL("CREATE TABLE scope_intervals (id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, start_ms INTEGER NOT NULL, end_ms INTEGER)")
        db.execSQL("CREATE TABLE synced_daily (scope TEXT NOT NULL, local_date TEXT NOT NULL, device_id TEXT NOT NULL, tz TEXT NOT NULL, views INTEGER, minutes INTEGER, coverage REAL NOT NULL, rev INTEGER NOT NULL, PRIMARY KEY(scope, local_date, device_id))")
        val initial = if (fresh) "guest:" + UUID.randomUUID() else "legacy"
        db.execSQL("INSERT INTO tracking_meta VALUES ('active_scope', ?)", arrayOf(initial))
        db.execSQL("INSERT INTO tracking_meta VALUES ('revision', '0')")
        for(op in listOf("INSERT", "UPDATE", "DELETE")) db.execSQL("CREATE TRIGGER daily_revision_${op.lowercase()} AFTER $op ON daily BEGIN UPDATE tracking_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'; END")
        for(op in listOf("INSERT", "DELETE")) db.execSQL("CREATE TRIGGER heartbeat_revision_${op.lowercase()} AFTER $op ON heartbeats BEGIN UPDATE tracking_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'; END")
        db.execSQL("INSERT INTO scope_intervals(scope, start_ms) VALUES (?, ?)", arrayOf(initial, if (fresh) System.currentTimeMillis() else 0L))
    }

    @Synchronized
    fun dataRevision(): Long = readableDatabase.rawQuery("SELECT value FROM tracking_meta WHERE key='revision'", null).use { if(it.moveToFirst()) it.getLong(0) else 0L }

    @Synchronized
    fun activeScope(): String = capturedScope.get() ?: readableDatabase.rawQuery("SELECT value FROM tracking_meta WHERE key = 'active_scope'", null).use { it.moveToFirst(); it.getString(0) }

    /** A recorder retains its write owner even if an old callback finishes after logout. */
    fun capturedStore(): TrackingStore {
        val scope = activeScope()
        fun <T> bound(fn: () -> T): T = synchronized(this) {
            val previous = capturedScope.get()
            val resolved = readableDatabase.rawQuery("SELECT target FROM scope_bindings WHERE source=?", arrayOf(scope)).use { if(it.moveToFirst()) it.getString(0) else scope }
            capturedScope.set(resolved)
            try { fn() } finally { capturedScope.set(previous) }
        }
        return object : TrackingStore {
            override fun recordView(e: ViewEvent) = bound { this@SqliteStore.recordView(e) }
            override fun addTime(d: String, p: String, s: Long, u: Long) = bound { this@SqliteStore.addTime(d, p, s, u) }
            override fun setUsage(d: String, p: String, u: Long) = bound { this@SqliteStore.setUsage(d, p, u) }
            override fun saveRing(p: String, r: List<String>, t: Long) = bound { this@SqliteStore.saveRing(p, r, t) }
            override fun loadRing(p: String, n: Long, a: Long) = bound { this@SqliteStore.loadRing(p, n, a) }
            override fun heartbeat(d: String, m: Int) = bound { this@SqliteStore.heartbeat(d, m) }
            override fun heartbeatMinutes(d: String) = bound { this@SqliteStore.heartbeatMinutes(d) }
            override fun daily(d: String) = bound { this@SqliteStore.daily(d) }
            override fun events(t: Long) = bound { this@SqliteStore.events(t) }
        }
    }

    @Synchronized
    fun selectScope(next: String) {
        require(next == "legacy" || next.matches(Regex("(guest|account|pending):[A-Za-z0-9_-]{1,128}")))
        val previous = activeScope()
        if (previous == next) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            val now = System.currentTimeMillis()
            db.execSQL("UPDATE scope_intervals SET end_ms = ? WHERE scope = ? AND end_ms IS NULL", arrayOf(now, previous))
            db.execSQL("INSERT INTO scope_intervals(scope, start_ms) VALUES (?, ?)", arrayOf(next, now))
            db.execSQL("UPDATE tracking_meta SET value = ? WHERE key = 'active_scope'", arrayOf(next))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    /** Same source may be retried, but can never be assigned to a different account. */
    @Synchronized
    fun importGuest(source: String, target: String, allowLegacy: Boolean = false) {
        require(source.startsWith("guest:") || source.startsWith("pending:") || (source == "legacy" && allowLegacy))
        require(target.startsWith("account:"))
        val db = writableDatabase
        db.beginTransaction()
        try {
            val previous = db.rawQuery("SELECT target FROM scope_bindings WHERE source = ?", arrayOf(source)).use { if(it.moveToFirst()) it.getString(0) else null }
            require(previous == null || previous == target) { "This guest dataset already belongs to another account" }
            if (previous != null) { db.setTransactionSuccessful(); return }
            db.execSQL("INSERT INTO scope_bindings VALUES (?, ?)", arrayOf(source, target))
            db.execSQL("""INSERT INTO daily(scope, local_date, pkg, views, ad_views, surface_ms, unknown_ms, usage_ms, tz, status, usage_observed)
                SELECT ?, local_date, pkg, views, ad_views, surface_ms, unknown_ms, usage_ms, tz, status, usage_observed FROM daily WHERE scope = ?
                ON CONFLICT(scope, local_date, pkg) DO UPDATE SET views=daily.views+excluded.views, ad_views=daily.ad_views+excluded.ad_views, surface_ms=daily.surface_ms+excluded.surface_ms, unknown_ms=daily.unknown_ms+excluded.unknown_ms, usage_ms=daily.usage_ms+excluded.usage_ms, usage_observed=MAX(daily.usage_observed,excluded.usage_observed), status=CASE WHEN daily.status='validated' AND excluded.status='validated' THEN 'validated' ELSE 'experimental' END""", arrayOf(target, source))
            db.execSQL("UPDATE events SET scope = ? WHERE scope = ?", arrayOf(target, source))
            db.execSQL("INSERT OR IGNORE INTO heartbeats SELECT ?, local_date, minute FROM heartbeats WHERE scope = ?", arrayOf(target, source))
            db.execSQL("UPDATE scope_intervals SET scope = ? WHERE scope = ?", arrayOf(target, source))
            for (table in listOf("daily", "heartbeats", "rings")) db.execSQL("DELETE FROM $table WHERE scope = ?", arrayOf(source))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    @Synchronized
    fun usageIntervals(start: Long, end: Long): List<Pair<Long, Long>> = readableDatabase.rawQuery(
        "SELECT MAX(start_ms, ?), MIN(COALESCE(end_ms, ?), ?) FROM scope_intervals WHERE scope = ? AND start_ms < ? AND COALESCE(end_ms, ?) > ?",
        arrayOf(start.toString(), end.toString(), end.toString(), activeScope(), end.toString(), end.toString(), start.toString()),
    ).use { c -> buildList { while(c.moveToNext()) add(c.getLong(0) to c.getLong(1)) } }

    @Synchronized
    fun setSourceDevice(id: String) { writableDatabase.execSQL("INSERT OR REPLACE INTO tracking_meta VALUES ('device_id', ?)", arrayOf(id)) }

    @Synchronized
    fun mergeSynced(json: String, expectedScope: String) {
        require(expectedScope == activeScope() && expectedScope.startsWith("account:"))
        val rows = JSONArray(json)
        require(rows.length() <= 4000)
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (i in 0 until rows.length()) {
                val d = rows.getJSONObject(i)
                val v = ContentValues().apply {
                    put("scope", expectedScope); put("local_date", d.getString("localDate")); put("device_id", d.getString("deviceId")); put("tz", d.getString("tz")); put("rev", d.getLong("rev")); put("coverage", d.getDouble("coverage"))
                    if (d.isNull("views")) putNull("views") else put("views", d.getInt("views"))
                    if (d.isNull("minutes")) putNull("minutes") else put("minutes", d.getInt("minutes"))
                }
                val rev = db.rawQuery("SELECT rev FROM synced_daily WHERE scope=? AND local_date=? AND device_id=?", arrayOf(expectedScope, d.getString("localDate"), d.getString("deviceId"))).use { if(it.moveToFirst()) it.getLong(0) else -1L }
                if(d.getLong("rev") >= rev) db.insertWithOnConflict("synced_daily", null, v, SQLiteDatabase.CONFLICT_REPLACE)
            }
            db.execSQL("DELETE FROM synced_daily WHERE local_date < ?", arrayOf(java.time.LocalDate.now().minusDays(399).toString()))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    @Synchronized
    fun localMetadata(date: String): Map<String, Any?> = readableDatabase.rawQuery("SELECT tz, status, usage_observed FROM daily WHERE scope=? AND local_date=?", arrayOf(activeScope(),date)).use { c ->
        var zone=ZoneId.systemDefault().id;var status="validated";var observed=false;var rows=0
        while(c.moveToNext()) {rows++;zone=c.getString(0);if(c.getString(1)!="validated") status="experimental";if(c.getInt(2)>0)observed=true}
        mapOf("recordedTz" to zone,"measurementStatus" to if(rows==0) "unavailable" else status,"usageObserved" to observed)
    }

    @Synchronized
    fun personalMeasurement(date: String, packages: Set<String>): Map<String, Any?> {
        val own = daily(date).filter { it.pkg in packages }
        val localViews = own.sumOf { it.views }
        val knownLocal = own.isNotEmpty() && (heartbeatMinutes(date)>0 || localViews>0)
        var views: Int? = if(knownLocal) localViews else null
        var minutes: Int? = null
        var status = "unavailable"
        var tz = ZoneId.systemDefault().id
        readableDatabase.rawQuery("SELECT status, tz, usage_observed FROM daily WHERE scope=? AND local_date=?", arrayOf(activeScope(), date)).use { c ->
            var experimental = false; var observed = false
            while(c.moveToNext()) { if(c.getString(0)!="validated") experimental=true; tz=c.getString(1); if(c.getInt(2)>0) observed=true }
            if(knownLocal) status=if(experimental) "experimental" else "validated"
            if(observed) minutes=(own.sumOf { it.usageMs } / 60000L).toInt()
            else if(heartbeatMinutes(date)>0) minutes=(own.sumOf { it.surfaceMs+it.unknownMs } / 60000L).toInt()
        }
        val source = readableDatabase.rawQuery("SELECT value FROM tracking_meta WHERE key='device_id'", null).use { if(it.moveToFirst()) it.getString(0) else "" }
        var restored = false
        readableDatabase.rawQuery("SELECT device_id, views, minutes, tz FROM synced_daily WHERE scope=? AND local_date=?", arrayOf(activeScope(), date)).use { c ->
            while(c.moveToNext()) {
                if(c.getString(0)==source && own.isNotEmpty()) continue
                if(!c.isNull(1)) { views=(views ?: 0)+c.getInt(1); restored=true }
                if(!c.isNull(2)) minutes=(minutes ?: 0)+c.getInt(2)
                if(own.isEmpty()) tz=c.getString(3)
            }
        }
        if(restored && !knownLocal) status="synced"
        return mapOf("localDate" to date, "views" to views, "minutes" to minutes, "status" to status, "tz" to tz, "scope" to activeScope(), "source" to if(restored) "account" else "phone")
    }

    companion object {
        const val DB_NAME = "driftless_tracking.db"
        const val SCHEMA_VERSION = 3

        @Volatile private var instance: SqliteStore? = null

        fun get(context: Context): SqliteStore =
            instance ?: synchronized(this) { instance ?: SqliteStore(context).also { instance = it } }
    }
}
