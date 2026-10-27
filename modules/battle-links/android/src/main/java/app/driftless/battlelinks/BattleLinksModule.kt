package app.driftless.battlelinks

import android.os.Handler
import android.os.Looper
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

/** Play supplies the install referral; it never accepts or creates a friendship. */
class BattleLinksModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BattleLinks")
        AsyncFunction("installReferrer") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("NO_CONTEXT", "App is not ready", null)
                return@AsyncFunction
            }
            val client = InstallReferrerClient.newBuilder(context).build()
            val finished = AtomicBoolean(false)
            val handler = Handler(Looper.getMainLooper())
            val timeout = Runnable {
                if (finished.compareAndSet(false, true)) {
                    client.endConnection()
                    promise.reject("REFERRER_TIMEOUT", "Install referral is not ready", null)
                }
            }
            fun finish(value: String?, failure: Boolean = false) {
                if (!finished.compareAndSet(false, true)) return
                handler.removeCallbacks(timeout)
                client.endConnection()
                if (failure) promise.reject("REFERRER_UNAVAILABLE", "Install referral is not ready", null)
                else promise.resolve(value)
            }
            handler.postDelayed(timeout, 8000)
            try {
                client.startConnection(object : InstallReferrerStateListener {
                    override fun onInstallReferrerSetupFinished(responseCode: Int) {
                        when (responseCode) {
                            InstallReferrerClient.InstallReferrerResponse.OK -> {
                                try { finish(client.installReferrer.installReferrer) }
                                catch (_: Exception) { finish(null, true) }
                            }
                            InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> finish(null)
                            else -> finish(null, true)
                        }
                    }
                    override fun onInstallReferrerServiceDisconnected() { finish(null, true) }
                })
            } catch (_: Exception) { finish(null, true) }
        }
    }
}
