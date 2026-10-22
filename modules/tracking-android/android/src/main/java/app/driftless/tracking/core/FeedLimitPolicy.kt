package app.driftless.tracking.core

data class FeedSettings(
    val enforceGoal: Boolean = false,
    val breaksEnabled: Boolean = false,
    val everyViews: Int = 50,
    val breakMinutes: Int = 5,
    val maxBypasses: Int = 3,
    val bypassMinutes: Int = 5,
    val allowUnvalidated: Boolean = false,
)

/** One combined daily allowance and bypass budget across Reels and Shorts. */
data class FeedState(
    val date: String,
    val milestone: Int = 0,
    val breakUntilMs: Long = 0,
    val bypassUntilMs: Long = 0,
    val bypasses: Int = 0,
)
enum class FeedReason { DAILY_VIDEOS, BREAK, APP_LIMIT, SCHEDULE }
data class FeedDecision(val reason: FeedReason?, val state: FeedState)

object FeedLimitPolicy {
    fun evaluate(settings: FeedSettings, state: FeedState, date: String, now: Long,
                 count: Int, goal: Int?, surface: Surface, validated: Boolean, entitled: Boolean): FeedDecision {
        var next = if (state.date == date) state else FeedState(date)
        fun allow() = FeedDecision(null, next)
        if ((FeatureAccess.SUBSCRIPTIONS_REQUIRED && !entitled) || surface != Surface.SHORT_VIDEO || (!validated && !settings.allowUnvalidated)) return allow()
        if (next.bypassUntilMs > now) return allow()
        // The Nth qualifying view consumes the allowance. Pause at count >= N, until local midnight.
        if (settings.enforceGoal && goal != null && goal > 0 && count >= goal)
            return FeedDecision(FeedReason.DAILY_VIDEOS, next)
        if (!settings.breaksEnabled) return allow()
        if (next.breakUntilMs > now) return FeedDecision(FeedReason.BREAK, next)
        val every = settings.everyViews.coerceIn(1, 2000)
        val milestone = count / every * every
        if (milestone > next.milestone) {
            next = next.copy(milestone = milestone,
                breakUntilMs = now + settings.breakMinutes.coerceIn(1, 60) * 60_000L)
            return FeedDecision(FeedReason.BREAK, next)
        }
        return allow()
    }

    fun bypass(settings: FeedSettings, state: FeedState, date: String, now: Long): FeedState? {
        val current = if (state.date == date) state else FeedState(date)
        if (current.bypasses >= settings.maxBypasses.coerceIn(0, 10)) return null
        return current.copy(bypasses = current.bypasses + 1,
            bypassUntilMs = now + settings.bypassMinutes.coerceIn(1, 30) * 60_000L)
    }
}
