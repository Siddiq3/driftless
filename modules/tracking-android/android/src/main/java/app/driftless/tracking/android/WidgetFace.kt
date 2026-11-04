package app.driftless.tracking.android

/**
 * What the home-screen widget shows besides the count. Pure so it can be unit tested.
 * Mood follows the same rule as the in-app count badge: the smallest enabled video limit.
 * Unknown counts never claim a mood or an allowance.
 */
data class WidgetFace(val pose: Pose, val goalText: String?, val streakText: String?) {
    enum class Pose { FRESH, FOCUSED, DRAINED, RESTING }

    companion object {
        fun of(count: Int?, goal: Int?, active: Boolean, streak: Int?): WidgetFace {
            val streakText = streak?.takeIf { it > 0 }?.let { "🔥 $it-day streak" }
            if (!active || count == null) return WidgetFace(Pose.RESTING, null, streakText)
            if (goal == null || goal <= 0) return WidgetFace(Pose.FRESH, null, streakText)
            val left = goal - count
            val pose = when {
                left <= 0 -> Pose.DRAINED
                count * 10 >= goal * 8 -> Pose.FRESH
                (streak ?: 0) >= 7 -> Pose.FOCUSED
                else -> Pose.FRESH
            }
            val goalText = if (left <= 0) "Daily limit reached" else "$left left of $goal today"
            return WidgetFace(pose, goalText, streakText)
        }
    }
}
