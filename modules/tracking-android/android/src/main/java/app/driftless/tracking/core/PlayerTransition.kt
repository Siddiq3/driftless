package app.driftless.tracking.core

/** A player's visible structure disappearing and returning is a replacement, unlike a caption edit.
 * Some YouTube versions emit content-change events without TYPE_VIEW_SCROLLED.
 * This signal only authorizes a novel identity; dwell and the recent-item ring still apply.
 */
class PlayerTransition {
    private var packageName: String? = null
    private var hadContainer = false
    private var missingSince: Long? = null

    private var lastTime: Long? = null
    fun reset() { packageName=null; hadContainer=false; missingSince=null; lastTime=null }

    fun observe(pkg: String, c: Classification, now: Long): Boolean {
        if(lastTime?.let { now<it }==true) return false
        lastTime=now
        if (pkg != packageName || c.surface != Surface.SHORT_VIDEO) {
            packageName = pkg
            hadContainer = false
            missingSince = null
        }
        if (c.surface != Surface.SHORT_VIDEO) return false
        if (!c.itemContainerPresent) {
            if (hadContainer && missingSince == null) missingSince = now
            return false
        }
        val replaced = missingSince?.let { now >= it && now - it <= ViewCounter.IDENTITY_SETTLE_MS } == true
        hadContainer = true
        missingSince = null
        return replaced
    }
}
