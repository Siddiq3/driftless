package app.driftless.tracking.core

/** Release policy, independent of real purchase records. Matches JS config/access.ts. */
object FeatureAccess {
    const val SUBSCRIPTIONS_REQUIRED = false
    fun focusAllowed(entitlement: CachedEntitlement, nowMs: Long): Boolean =
        !SUBSCRIPTIONS_REQUIRED || BlockPolicy.entitled(entitlement, nowMs)
}
