package app.driftless.tracking.core

/** Detects a player replacement or a settled change in corroborated item metadata.
 * Some YouTube versions emit content-change events without TYPE_VIEW_SCROLLED.
 * This signal only authorizes a novel identity; dwell and the recent-item ring still apply.
 */
class PlayerTransition {
    private var packageName: String? = null
    private var hadContainer = false
    private var missingSince: Long? = null
    private var baseline: Set<String> = emptySet()
    private var candidate: String? = null
    private var candidateSince = 0L

    val awaitingIdentity: Boolean get() = candidate != null

    private var lastTime: Long? = null
    fun reset() { packageName=null; hadContainer=false; missingSince=null; lastTime=null; baseline=emptySet(); candidate=null }

    fun observe(pkg: String, c: Classification, now: Long): Boolean {
        if(lastTime?.let { now<it }==true) return false
        lastTime=now
        if (pkg != packageName || c.surface != Surface.SHORT_VIDEO) {
            packageName = pkg
            hadContainer = false
            missingSince = null
            baseline = emptySet()
            candidate = null
        }
        if (c.surface != Surface.SHORT_VIDEO) return false
        if (!c.itemContainerPresent) {
            candidate = null
            if (hadContainer && missingSince == null) missingSince = now
            return false
        }
        val replaced = missingSince?.let { now >= it && now - it <= ViewCounter.IDENTITY_SETTLE_MS } == true
        hadContainer = true
        missingSince = null
        if (replaced || baseline.size < 2) {
            // Loading frames can expose just the channel before the title arrives. Keep
            // the last complete identity so the settled title can still confirm the swipe.
            if (c.identitySignals.size >= 2 || baseline.isEmpty()) baseline = c.identitySignals
            candidate = null
            return replaced
        }
        // YouTube can reuse the entire player and emit only content changes. Require
        // multiple metadata nodes (e.g. channel AND title), then a settled identity.
        // One may stay the same when consecutive Shorts belong to the same channel.
        val changed = c.fingerprint != null &&
            baseline.size >= 2 && c.identitySignals.size >= 2 &&
            (baseline - c.identitySignals).isNotEmpty() && (c.identitySignals - baseline).isNotEmpty()
        if (!changed) { candidate = null; return false }
        if (candidate != c.fingerprint) {
            candidate = c.fingerprint
            candidateSince = now
            return false
        }
        if (now - candidateSince < IDENTITY_DEBOUNCE_MS) return false
        baseline = c.identitySignals
        candidate = null
        return true
    }

    companion object { const val IDENTITY_DEBOUNCE_MS = 400L }
}
