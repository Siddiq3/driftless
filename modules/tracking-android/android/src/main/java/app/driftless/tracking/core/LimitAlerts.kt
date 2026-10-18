package app.driftless.tracking.core

/** A daily limit the user set in the app (mirrored from the JS goals store). */
data class Limit(val metric: String, val dailyLimit: Int)

data class Alert(val metric: String, val percent: Int, val used: Int, val limit: Int)

/**
 * Decides which goal notifications to send now. Each (date, metric, threshold) fires at most once.
 * `views` is only alerted when counting accuracy is validated (never nag on unconfirmed numbers).
 */
object LimitAlerts {
    val THRESHOLDS = listOf(80, 100)

    fun due(
        limits: List<Limit>,
        minutesUsed: Int?,
        viewsUsed: Int?,
        alreadySent: Set<String>,
        localDate: String,
    ): List<Pair<String, Alert>> {
        val out = mutableListOf<Pair<String, Alert>>()
        for (l in limits) {
            if (l.dailyLimit <= 0) continue
            val used = when (l.metric) {
                "minutes" -> minutesUsed
                "views" -> viewsUsed
                else -> null
            } ?: continue
            // Highest threshold reached only, so the user isn't sent 80% and 100% at the same moment.
            val reached = THRESHOLDS.filter { used * 100 >= it * l.dailyLimit }.maxOrNull() ?: continue
            val key = "$localDate|${l.metric}|$reached"
            if (key in alreadySent) continue
            out += key to Alert(l.metric, reached, used, l.dailyLimit)
        }
        return out
    }
}
