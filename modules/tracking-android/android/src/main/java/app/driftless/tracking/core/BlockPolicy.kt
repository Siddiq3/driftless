package app.driftless.tracking.core

/** Focus window, local time. Days use java.time DayOfWeek values 1 (Mon) .. 7 (Sun). */
data class Schedule(val days: Set<Int>, val startMinute: Int, val endMinute: Int) {
    /** True if [minuteOfDay] on [dayOfWeek] falls inside; windows may cross midnight (22:00–07:00). */
    fun contains(dayOfWeek: Int, minuteOfDay: Int): Boolean {
        if (startMinute == endMinute) return false
        return if (startMinute < endMinute) {
            dayOfWeek in days && minuteOfDay >= startMinute && minuteOfDay < endMinute
        } else {
            // Overnight: the part after start belongs to the start day, the part before end to the next day.
            val prevDay = if (dayOfWeek == 1) 7 else dayOfWeek - 1
            (dayOfWeek in days && minuteOfDay >= startMinute) || (prevDay in days && minuteOfDay < endMinute)
        }
    }
}

data class BlockConfig(
    val enabled: Boolean,
    val apps: Set<String>,
    /** Block once today's minutes in the app reach this; null = no limit-based block. */
    val dailyMinutes: Int?,
    val schedules: List<Schedule>,
    val feedOnly: Boolean = false,
    val feed: FeedSettings = FeedSettings(),
)

/** Server-verified entitlement cached on the device (D-008: works offline until it expires). */
data class CachedEntitlement(val pro: Boolean, val validUntilMs: Long?)

enum class BlockReason { LIMIT, SCHEDULE }

data class BlockDecision(val block: Boolean, val reason: BlockReason?)

/**
 * Pure decision: should the pause screen show for [pkg] now?
 * Fails open: anything missing or expired means "don't block". Free tracking is never affected.
 */
object BlockPolicy {
    private val ALLOW = BlockDecision(false, null)

    fun decide(
        pkg: String,
        config: BlockConfig,
        entitlement: CachedEntitlement,
        minutesToday: Int?,
        dayOfWeek: Int,
        minuteOfDay: Int,
        snoozedUntilMs: Long,
        nowMs: Long,
    ): BlockDecision {
        if (!config.enabled || pkg !in config.apps) return ALLOW
        if (!entitled(entitlement, nowMs)) return ALLOW
        if (snoozedUntilMs > nowMs) return ALLOW
        if (config.schedules.any { it.contains(dayOfWeek, minuteOfDay) }) return BlockDecision(true, BlockReason.SCHEDULE)
        val limit = config.dailyMinutes
        if (limit != null && minutesToday != null && minutesToday >= limit) return BlockDecision(true, BlockReason.LIMIT)
        return ALLOW
    }

    /** Same live gate for enforcement and capability reporting. */
    fun entitled(entitlement: CachedEntitlement, nowMs: Long): Boolean =
        entitlement.pro && (entitlement.validUntilMs == null || entitlement.validUntilMs > nowMs)

    /** Cached entitlements are trusted for at most this long past the last server check, offline. */
    const val OFFLINE_GRACE_MS = 3L * 24 * 3600 * 1000

    /** How long a cached entitlement may be used: until its expiry, capped at last check + grace. */
    fun validUntil(expiresAtMs: Long?, verifiedAtMs: Long): Long =
        minOf(expiresAtMs ?: Long.MAX_VALUE, verifiedAtMs + OFFLINE_GRACE_MS)

    const val SNOOZE_MS = 5 * 60_000L
    const val MAX_SNOOZES_PER_DAY = 3
}
