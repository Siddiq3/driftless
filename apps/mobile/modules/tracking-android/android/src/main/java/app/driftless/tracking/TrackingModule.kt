package app.driftless.tracking

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Phase 1 scaffold. The AccessibilityService, classifier, dedup and Room store arrive in Phase 2
 * (IMPLEMENTATION_PLAN P2-01) behind the Google Play prominent-disclosure flow.
 * Until then the module reports honestly that tracking is not implemented.
 */
class TrackingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DriftlessTracking")

    Function("getHealth") {
      mapOf(
        "engineVersion" to ENGINE_VERSION,
        "implemented" to false,
        "serviceEnabled" to false,
        "usageAccessGranted" to false,
      )
    }
  }

  companion object {
    const val ENGINE_VERSION = 0
  }
}
