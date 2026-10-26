package app.driftless.tracking.android

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.os.SystemClock
import android.provider.Settings
import app.driftless.tracking.core.Recorder
import java.time.ZoneId
import org.json.JSONObject

/** Separate accounting high-water marks survive a display-history reset. No raw content or
 * cross-device intervals leave the phone; foreground milliseconds add across devices. */
class AccountUsage(private val store: SqliteStore, private val context: Context) {
    private val db get() = store.writableDatabase
    private fun boot() = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
    private fun scope() = store.activeScope()
    internal fun meta(name: String): JSONObject? = db.rawQuery("SELECT value FROM account_meta WHERE scope=? AND name=?", arrayOf(scope(), name)).use {
        if (it.moveToFirst()) JSONObject(it.getString(0)) else null
    }
    internal fun save(name: String, value: JSONObject) = db.execSQL("INSERT OR REPLACE INTO account_meta VALUES (?,?,?)", arrayOf(scope(), name, value.toString()))
    fun policy(): JSONObject? = meta("policy")
    fun zone(): ZoneId = policy()?.takeIf { !trustedClock() || now()>=it.getLong("activeFromMs") }?.getString("tz")?.let { ZoneId.of(it) } ?: ZoneId.systemDefault()
    fun trustedClock(): Boolean = meta("clock")?.let { it.optInt("boot", -2) == boot() && boot() >= 0 && SystemClock.elapsedRealtime() >= it.optLong("elapsed") } == true
    fun now(): Long = if (trustedClock()) meta("clock")!!.let { it.getLong("server") + SystemClock.elapsedRealtime() - it.getLong("elapsed") } else System.currentTimeMillis()
    fun date(): String = Recorder.localDate(now(), zone())
    fun active(): Boolean = scope().startsWith("account:") && policy()?.let { !trustedClock() || now() >= it.getLong("activeFromMs") } == true
    fun markClockUncertain() { save("clock_error",JSONObject().put("date",date())) }
    fun resetGeneration(): Long = meta("reset")?.optLong("generation", 0L) ?: 0L
    fun cutoff(): Long = meta("reset")?.optLong("cutoff", 0L) ?: 0L
    fun install(json: String, expectedScope: String) = synchronized(store) {
        require(scope() == expectedScope && expectedScope.startsWith("account:"))
        val response = JSONObject(json)
        val policy = response.optJSONObject("policy") ?: return@synchronized
        require("account:${policy.getString("incarnation")}" == expectedScope)
        val prior = policy()
        require(prior == null || prior.getString("tz") == policy.getString("tz"))
        if (prior != null && prior.getLong("rev") > policy.getLong("rev")) return@synchronized
        db.beginTransaction()
        try {
            save("policy", policy)
            val server = response.optLong("serverTimeMs", 0L)
            if (server > 0) save("clock", JSONObject().put("server", if(trustedClock()) maxOf(server,now()) else server).put("elapsed", SystemClock.elapsedRealtime()).put("boot", boot()))
            val snapshot = response.optJSONObject("snapshot")
            if (snapshot != null) {
                require(snapshot.getString("incarnation") == policy.getString("incarnation"))
                val name = "snapshot:${snapshot.getString("localDate")}"
                val old = meta(name)
                if (old == null || old.getLong("rev") <= snapshot.getLong("rev")) save(name, snapshot)
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }
    fun installHistory(json:String,expectedScope:String) = synchronized(store) {
        require(scope()==expectedScope && expectedScope=="account:${policy()?.getString("incarnation")}")
        val days=org.json.JSONArray(json);require(days.length()<=400)
        db.beginTransaction()
        try {
            for(i in 0 until days.length()) {
                val snap=days.getJSONObject(i)
                require(snap.getString("incarnation")==policy()!!.getString("incarnation") && snap.getString("tz")==policy()!!.getString("tz"))
                val date=snap.getString("localDate")
                if(cutoff()>0 && date<Recorder.localDate(cutoff(),zone())) continue
                val name="snapshot:$date"
                val old=meta(name)
                if(old==null || old.getLong("rev")<=snap.getLong("rev")) save(name,snap)
            }
            db.setTransactionSuccessful()
        } finally {db.endTransaction()}
    }
    private fun touch(date: String) {
        db.execSQL("INSERT OR IGNORE INTO account_period VALUES (?,?,0)", arrayOf(scope(), date))
        db.execSQL("UPDATE account_period SET rev=rev+1 WHERE scope=? AND date=?", arrayOf(scope(), date))
        db.execSQL("INSERT OR REPLACE INTO account_pending SELECT scope,date,rev FROM account_period WHERE scope=? AND date=?", arrayOf(scope(),date))
    }
    /** Called inside recordView's existing event transaction. Deduplication survives reset. */
    fun view(eventId: String, date: String, pkg: String,atMs:Long): Boolean {
        if (!active() || !trustedClock() || atMs<policy()!!.getLong("activeFromMs")) return true
        val inserted = android.content.ContentValues().apply { put("scope", scope()); put("event_id", eventId) }
        if (db.insertWithOnConflict("account_seen", null, inserted, SQLiteDatabase.CONFLICT_IGNORE) == -1L) return false
        db.execSQL("INSERT OR IGNORE INTO account_totals VALUES (?,?,?,NULL,NULL)", arrayOf(scope(), date, pkg))
        db.execSQL("UPDATE account_totals SET views=COALESCE(views,0)+1 WHERE scope=? AND date=? AND pkg=?", arrayOf(scope(), date, pkg))
        touch(date)
        return true
    }
    /** Full-period OS totals use high-water marks, independent of the visible reset cutoff. */
    fun usage(date: String, pkg: String, ms: Long) {
        if (!active() || !trustedClock() || date < Recorder.localDate(policy()!!.getLong("activeFromMs"),ZoneId.of(policy()!!.getString("tz")))) return
        db.execSQL("INSERT OR IGNORE INTO account_totals VALUES (?,?,?,NULL,NULL)", arrayOf(scope(), date, pkg))
        val old = db.rawQuery("SELECT usage_ms FROM account_totals WHERE scope=? AND date=? AND pkg=?", arrayOf(scope(), date, pkg)).use { it.moveToFirst(); if(it.isNull(0)) null else it.getLong(0) }
        if (old == null || ms > old) {
            db.execSQL("UPDATE account_totals SET usage_ms=? WHERE scope=? AND date=? AND pkg=?", arrayOf(maxOf(ms, old ?: 0), scope(), date, pkg))
            touch(date)
        }
    }
    fun observeViews(date: String, packages: Set<String>) {
        if(!active() || !trustedClock()) return
        for(pkg in packages) {
            db.execSQL("INSERT OR IGNORE INTO account_totals VALUES (?,?,?,NULL,NULL)", arrayOf(scope(),date,pkg))
            val missing=db.rawQuery("SELECT views IS NULL FROM account_totals WHERE scope=? AND date=? AND pkg=?",arrayOf(scope(),date,pkg)).use { it.moveToFirst(); it.getInt(0)==1 }
            if(missing) { db.execSQL("UPDATE account_totals SET views=0 WHERE scope=? AND date=? AND pkg=?",arrayOf(scope(),date,pkg)); touch(date) }
        }
    }
    fun forget() = synchronized(store) {
        for(table in listOf("account_meta","account_totals","account_period","account_pending","account_seen","account_intervals")) db.execSQL("DELETE FROM $table WHERE scope=?",arrayOf(scope()))
    }
    fun info(): String = synchronized(store) {
        val limits=if(active()) limits() else JSONObject()
        val used=JSONObject()
        for(k in limits.keys()) used.put(k,effectiveUsage(k) ?: JSONObject.NULL)
        JSONObject().put("remaining",remainingCredit()).put("accountTz",policy()?.getString("tz") ?: zone().id).put("limits",limits).put("used",used).put("tz",zone().id).put("active",active()).put("status",status()).put("cutoffMs",cutoff()).put("resetGeneration",resetGeneration()).put("nowMs",now()).toString()
    }
    private fun apps(date: String): JSONObject {
        val out = JSONObject()
        val minutesAvailable=(date!=date() || UsageReader.granted(context)) && meta("clock_error")?.optString("date")!=date
        db.rawQuery("SELECT pkg,views,usage_ms FROM account_totals WHERE scope=? AND date=?", arrayOf(scope(), date)).use { c ->
            while(c.moveToNext()) out.put(c.getString(0), JSONObject().put("views", if(c.isNull(1)) JSONObject.NULL else c.getLong(1)).put("usageMs", if(c.isNull(2) || !minutesAvailable) JSONObject.NULL else c.getLong(2)))
        }
        return out
    }
    fun contributions(deviceId: String): String = synchronized(store) {
        val out = org.json.JSONArray()
        db.beginTransaction()
        try {
            val dates=mutableListOf<String>()
            db.rawQuery("SELECT date FROM account_period WHERE scope=? AND date>=? ORDER BY date LIMIT 400", arrayOf(scope(),java.time.Instant.ofEpochMilli(now()).atZone(zone()).toLocalDate().minusDays(399).toString())).use { c -> while(c.moveToNext()) dates.add(c.getString(0)) }
            for(date in dates) {
                val values=apps(date)
                val materialized=JSONObject().put("apps",values).put("resetGeneration",resetGeneration())
                // Permission/availability changes also revise the payload. A later retry must
                // never reuse a revision for different nullable measurements.
                val last=meta("materialized:$date")
                if(last!=null && last.toString()!=materialized.toString()) touch(date)
                save("materialized:$date",materialized)
                val rev=db.rawQuery("SELECT rev FROM account_pending WHERE scope=? AND date=?",arrayOf(scope(),date)).use { c -> if(c.moveToFirst()) c.getLong(0) else null } ?: continue
                if(out.length()<16) out.put(JSONObject().put("incarnation", scope().removePrefix("account:")).put("periodId", "${scope().removePrefix("account:")}:$date")
                    .put("localDate", date).put("deviceId", deviceId).put("rev", rev).put("resetGeneration", resetGeneration()).put("apps",values))
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        out.toString()
    }
    fun acknowledge(period: String, rev: Long) = synchronized(store) {
        // Keep totals/revision permanently for this incarnation; only remove the dirty marker.
        db.execSQL("DELETE FROM account_pending WHERE scope=? AND date=? AND rev<=?", arrayOf(scope(), period, rev))
    }
    fun resetHistory() = synchronized(store) {
        db.beginTransaction()
        try {
            val cutoff=now()
            // Cumulative backup baselines are hidden from personal history. Keeping the old
            // per-device totals/revisions prevents a display reset from erasing cloud data.
            val resetScope=scope()
            val allScopes=mutableSetOf(resetScope)
            db.rawQuery("SELECT DISTINCT scope FROM daily",null).use { c -> while(c.moveToNext()) allScopes.add(c.getString(0)) }
            for(s in allScopes) store.inScope(s) {
                val currentDate=Recorder.localDate(cutoff,store.account.zone())
                val dates=store.storedDates(currentDate,currentDate)
                for(date in dates) {
                    val rows=org.json.JSONArray()
                    for(r in store.backupDaily(date)) rows.put(JSONObject().put("pkg",r.pkg).put("views",r.views).put("adViews",r.adViews).put("surfaceMs",r.surfaceMs).put("unknownMs",r.unknownMs).put("usageMs",r.usageMs))
                    val prior=meta("backup:$date")
                    save("backup:$date",JSONObject().put("rows",rows).put("beats",store.heartbeatMinutes(date)+(prior?.optInt("beats") ?: 0)).put("metadata",JSONObject(store.localMetadata(date))))
                }
            }
            val scopes=mutableSetOf(scope())
            db.rawQuery("SELECT scope FROM account_meta UNION SELECT scope FROM daily UNION SELECT scope FROM synced_daily UNION SELECT scope FROM scope_intervals",null).use { c -> while(c.moveToNext()) scopes.add(c.getString(0)) }
            for(s in scopes) {
                store.inScope(s) {
                    val currentDate=Recorder.localDate(cutoff,zone())
                    // Retain the current period and unacknowledged accounting, not a hidden
                    // archive of every cleared day. Frozen backup requests live separately.
                    db.execSQL("DELETE FROM account_meta WHERE scope=? AND (name LIKE 'snapshot:%' OR name LIKE 'backup:%' OR (name LIKE 'materialized:%' AND NOT EXISTS (SELECT 1 FROM account_pending p WHERE p.scope=account_meta.scope AND p.date=substr(account_meta.name,instr(account_meta.name,':')+1)))) AND substr(name,instr(name,':')+1) < ?",arrayOf(s,currentDate))
                    db.execSQL("DELETE FROM account_totals WHERE scope=? AND date<? AND NOT EXISTS (SELECT 1 FROM account_pending p WHERE p.scope=account_totals.scope AND p.date=account_totals.date)",arrayOf(s,currentDate))
                    val start=java.time.LocalDate.parse(currentDate).atStartOfDay(zone()).toInstant().toEpochMilli()
                    db.execSQL("DELETE FROM account_intervals WHERE scope=? AND end_ms IS NOT NULL AND end_ms<=?",arrayOf<Any>(s,start))
                    db.execSQL("UPDATE account_intervals SET start_ms=MAX(start_ms,?) WHERE scope=?",arrayOf<Any>(start,s))
                }
                val previous=db.rawQuery("SELECT value FROM account_meta WHERE scope=? AND name='reset'",arrayOf(s)).use { c -> if(c.moveToFirst()) JSONObject(c.getString(0)).optLong("generation") else 0L }
                db.execSQL("INSERT OR REPLACE INTO account_meta VALUES (?,'reset',?)",arrayOf(s,JSONObject().put("generation",previous+1).put("cutoff",cutoff).toString()))
                db.execSQL("INSERT OR REPLACE INTO account_meta VALUES (?,'mute_alerts',?)",arrayOf(s,JSONObject().put("muted",true).toString()))
            }
            db.execSQL("DELETE FROM scope_intervals")
            db.execSQL("INSERT INTO scope_intervals(scope,start_ms) VALUES (?,?)",arrayOf(scope(),cutoff))
            db.execSQL("DELETE FROM scope_bindings")
            // Bump cumulative revisions, never zero accounting or rewrite a frozen request.
            db.execSQL("UPDATE account_period SET rev=rev+1 WHERE EXISTS (SELECT 1 FROM account_totals t WHERE t.scope=account_period.scope AND t.date=account_period.date)")
            db.execSQL("INSERT OR REPLACE INTO account_pending SELECT scope,date,rev FROM account_period WHERE EXISTS (SELECT 1 FROM account_totals t WHERE t.scope=account_period.scope AND t.date=account_period.date)")
            store.wipeAll()
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }
    private fun limits(): JSONObject {
        meta("snapshot:${date()}")?.optJSONObject("limits")?.let { return it }
        val plans = policy()?.optJSONArray("policies") ?: return JSONObject()
        var selected = JSONObject()
        for (i in 0 until plans.length()) if(plans.getJSONObject(i).getString("effectiveDate") <= date()) selected=plans.getJSONObject(i).getJSONObject("limits")
        return selected
    }
    private fun used(apps: JSONObject, key: String): Long? {
        val field=if(key.startsWith("views")) "views" else "usageMs"
        val pkg=key.substringAfter(':', "")
        if(pkg.isNotEmpty()) return apps.optJSONObject(pkg)?.let { if(it.isNull(field)) null else it.getLong(field) }
        if(apps.length()==0) return null
        var total=0L
        for(p in apps.keys()) { val row=apps.getJSONObject(p); if(row.isNull(field)) return null; total+=row.getLong(field) }
        return total
    }
    /** Global snapshot plus this device's unacknowledged delta; its own reservation also caps
     * consumption. Never add local usage to a server total that already includes it. */
    fun status(pkg: String? = null, shortVideo: Boolean = true): String = synchronized(store) {
        if (!active()) return@synchronized "transition"
        val limits=JSONObject(limits().toString())
        if(!shortVideo) for(k in limits.keys().asSequence().toList()) if(k.startsWith("views")) limits.remove(k)
        if(pkg!=null) for(k in limits.keys().asSequence().toList()) if(k.contains(':') && k.substringAfter(':')!=pkg) limits.remove(k)
        if(!trustedClock()) return@synchronized "clock_unverified"
        val snap=meta("snapshot:${date()}") ?: return@synchronized "credit_required"
        if(now() >= snap.getLong("endMs")) return@synchronized "credit_required"
        if(limits.length()==0) return@synchronized "unlimited"
        if(limits.keys().asSequence().any { it.startsWith("minutes") } && (!UsageReader.granted(context) || meta("clock_error")?.optString("date")==date())) return@synchronized "measurement_unavailable"
        val deviceId=db.rawQuery("SELECT value FROM tracking_meta WHERE key='device_id'",null).use { if(it.moveToFirst()) it.getString(0) else "" }
        val mine=snap.getJSONObject("devices").optJSONObject(deviceId)
        val ownApps=apps(date())
        for(k in limits.keys()) {
            if(pkg!=null && k.contains(':') && k.substringAfter(':')!=pkg) continue
            val local=used(ownApps,k) ?: return@synchronized "measurement_unavailable"
            val accepted=mine?.optJSONObject("used")?.optLong(k,0L) ?: 0L
            val own=maxOf(local,accepted)
            val grant=mine?.optJSONObject("granted")?.optLong(k,0L) ?: 0L
            val global=snap.getJSONObject("used").optLong(k,0L)+maxOf(0L,own-accepted)
            if(own>=grant || global>=limits.getLong(k)) return@synchronized "credit_exhausted"
        }
        if(now()-snap.getLong("serverTimeMs")>60_000) "reserved_stale" else "reserved"
    }
    /** Spendable on this phone, not unreserved global headroom. Unknown is never zero. */
    fun remainingCredit(): JSONObject = synchronized(store) {
        val result=JSONObject();val limits=limits()
        val snap=meta("snapshot:${date()}")
        val deviceId=db.rawQuery("SELECT value FROM tracking_meta WHERE key='device_id'",null).use { if(it.moveToFirst()) it.getString(0) else "" }
        val mine=snap?.getJSONObject("devices")?.optJSONObject(deviceId)
        val local=apps(date())
        for(k in limits.keys()) {
            val observed=used(local,k)
            val total=effectiveUsage(k)
            if(snap==null || now()>=snap.getLong("endMs") || observed==null || total==null) {result.put(k,JSONObject.NULL);continue}
            val accepted=mine?.optJSONObject("used")?.optLong(k,0L) ?: 0L
            val grant=mine?.optJSONObject("granted")?.optLong(k,0L) ?: 0L
            result.put(k,minOf(limits.getLong(k)-total,grant-maxOf(observed,accepted)).coerceAtLeast(0))
        }
        result
    }
    fun effectiveUsage(metric: String, date: String = date()): Long? = synchronized(store) {
        val snap=meta("snapshot:$date") ?: return@synchronized null
        val deviceId=db.rawQuery("SELECT value FROM tracking_meta WHERE key='device_id'",null).use { if(it.moveToFirst()) it.getString(0) else "" }
        val accepted=snap.getJSONObject("devices").optJSONObject(deviceId)?.optJSONObject("used")
        val missing=snap.getJSONArray("unavailable").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
        val local=apps(date)
        val observed=if(local.length()==0) 0L else used(local,metric) ?: return@synchronized null
        if(metric in missing || !trustedClock()) return@synchronized null
        snap.getJSONObject("used").optLong(metric,0L)+maxOf(0,observed-(accepted?.optLong(metric,0L) ?: 0))
    }
    fun goalLimits(): List<app.driftless.tracking.core.Limit> = synchronized(store) {
        val values=limits()
        listOf("minutes","views").filter {values.has(it)}.map { metric -> app.driftless.tracking.core.Limit(metric,(values.getLong(metric)/if(metric=="minutes") 60000 else 1).toInt()) }
    }
    /** Reset suppresses cloud display through its cutoff day, including stale snapshots. */
    fun measurement(date: String, personal: Map<String,Pair<Long?,Long?>> = emptyMap()): Map<String,Any?>? = synchronized(store) {
        if(!active() || date<Recorder.localDate(policy()!!.getLong("activeFromMs"),zone()) || (cutoff()>0 && date<=Recorder.localDate(cutoff(),zone()))) return@synchronized null
        // Personal backup includes pre-sign-in observations which were never allowance charges.
        // Reconcile the two projections per stable device, never sum their overlapping totals.
        fun reconciled(metric: String): Long? {
            if(personal.isEmpty()) return effectiveUsage(metric,date)?.let { if(metric=="minutes") it/60000 else it }
            val devices=mutableMapOf<String,Long?>()
            val snap=meta("snapshot:$date")?.optJSONObject("devices")
            if(snap!=null) for(id in snap.keys()) {
                val value=snap.getJSONObject(id).optJSONObject("used")
                devices[id]=if(value==null || !value.has(metric)) null else value.getLong(metric).let { if(metric=="minutes") it/60000 else it }
            }
            val id=db.rawQuery("SELECT value FROM tracking_meta WHERE key='device_id'",null).use { if(it.moveToFirst()) it.getString(0) else "" }
            val local=apps(date)
            if(local.length()>0) used(local,metric)?.let { value ->
                val amount=if(metric=="minutes") value/60000 else value
                devices[id]=maxOf(devices[id] ?: 0,amount)
            }
            for((device,values) in personal) {
                val value=if(metric=="views") values.first else values.second
                if(value!=null) devices[device]=maxOf(devices[device] ?: 0,value)
            }
            return devices.values.filterNotNull().takeIf {it.isNotEmpty()}?.sum()
        }
        val views=reconciled("views"); val minutes=reconciled("minutes")
        mapOf("localDate" to date,"views" to views,"minutes" to minutes,"status" to if(views==null && minutes==null) "unavailable" else "experimental","tz" to zone().id,"scope" to scope(),"source" to "account")
    }
    fun blocked(pkg: String, shortVideo: Boolean = true): Boolean = active() && status(pkg,shortVideo) !in listOf("reserved", "reserved_stale", "unlimited")
    companion object {
        fun create(db: SQLiteDatabase) {
            db.execSQL("CREATE TABLE account_intervals(scope TEXT NOT NULL,start_ms INTEGER NOT NULL,end_ms INTEGER)")
            db.execSQL("CREATE TABLE account_meta(scope TEXT NOT NULL,name TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(scope,name))")
            db.execSQL("CREATE TABLE account_totals(scope TEXT NOT NULL,date TEXT NOT NULL,pkg TEXT NOT NULL,views INTEGER,usage_ms INTEGER,PRIMARY KEY(scope,date,pkg))")
            db.execSQL("CREATE TABLE account_period(scope TEXT NOT NULL,date TEXT NOT NULL,rev INTEGER NOT NULL,PRIMARY KEY(scope,date))")
            db.execSQL("CREATE TABLE account_pending(scope TEXT NOT NULL,date TEXT NOT NULL,rev INTEGER NOT NULL,PRIMARY KEY(scope,date))")
            db.execSQL("CREATE TABLE account_seen(scope TEXT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(scope,event_id))")
        }
    }
}
