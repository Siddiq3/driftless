package app.driftless.tracking.android

import java.time.LocalDate

/** Same completed-period and measured-data rule as the app's wrap entry points. */
data class ReadyWrap(val period: String, val end: String) {
    val from: String get() = if (period == "weekly") LocalDate.parse(end).minusDays(6).toString() else end
}

object WrapReady {
    fun periods(today: LocalDate): List<ReadyWrap> = listOf(
        ReadyWrap("weekly", today.minusDays(today.dayOfWeek.value.toLong()).toString()),
        ReadyWrap("daily", today.minusDays(1).toString()),
    )

    /** Reads the active scope's personal totals, including restored account days. */
    fun next(store: SqliteStore, packages: Set<String>, prefs: TrackingPrefs): ReadyWrap? =
        periods(LocalDate.parse(store.account.date())).firstOrNull { wrap ->
            if (prefs.shownWrapEnd(wrap.period) == wrap.end) false
            else {
                var date = LocalDate.parse(wrap.from)
                val end = LocalDate.parse(wrap.end)
                var measured = false
                while (!date.isAfter(end) && !measured) {
                    val day = store.personalMeasurement(date.toString(), packages)
                    measured = day["views"] is Number || day["minutes"] is Number
                    date = date.plusDays(1)
                }
                measured
            }
        }
}
