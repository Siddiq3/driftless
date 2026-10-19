package app.driftless.tracking.core

/** Only a recognized short-video surface on an unlocked foreground screen may show a badge. */
fun showCountBadge(enabled: Boolean, consent: Boolean, interactive: Boolean, locked: Boolean, sameApp: Boolean, surface: Surface): Boolean =
    enabled && consent && interactive && !locked && sameApp && surface == Surface.SHORT_VIDEO

enum class CountBadgeMood { HAPPY, DRAINED, UNKNOWN }
data class CountBadgeValue(val text: String, val status: String, val mood: CountBadgeMood = CountBadgeMood.HAPPY)

/** Mood reflects the saved daily total, including while the next video is being identified. */
@Suppress("UNUSED_PARAMETER")
fun countBadgeMood(count: Int, dailyLimit: Int?, identityAvailable: Boolean): CountBadgeMood = when {
    dailyLimit != null && dailyLimit > 0 && count > dailyLimit -> CountBadgeMood.DRAINED
    else -> CountBadgeMood.HAPPY
}

/** Display local counts without a prefix; validation remains available in tracking details. */
fun countBadgeValue(count: Int, validated: Boolean, identityAvailable: Boolean, dailyLimit: Int? = null): CountBadgeValue {
    val mood = countBadgeMood(count, dailyLimit, identityAvailable)
    return when {
    !identityAvailable -> CountBadgeValue(count.coerceAtLeast(0).toString(), "Not detected", mood)
    !validated -> CountBadgeValue("${count.coerceAtLeast(0)}", "Unconfirmed", mood)
    else -> CountBadgeValue(count.coerceAtLeast(0).toString(), "Today", mood)
}

}
