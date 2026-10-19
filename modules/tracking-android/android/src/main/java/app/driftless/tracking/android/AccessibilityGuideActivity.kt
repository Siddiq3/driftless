package app.driftless.tracking.android

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Rational
import android.util.Log

/** User-opened instruction window. Android owns every actual switch and permission decision. */
class AccessibilityGuideActivity : Activity() {
    private val main=Handler(Looper.getMainLooper())
    private lateinit var content: GuideVideoPlayer
    private var settingsOpened=false
    private var startedAt=0L
    private var enteredPip=false
    private var pipRequested=false
    private var enabledAtLaunch=false
    private val advance=object:Runnable {
        override fun run() {
            if (isFinishing) return
            // Close on completion, withdrawn consent, or after two minutes.
            if (!TrackingPrefs(this@AccessibilityGuideActivity).disclosureAccepted || (!enabledAtLaunch && Health.serviceEnabled(this@AccessibilityGuideActivity)) || System.currentTimeMillis()-startedAt>120_000L) {
                finish(); return
            }
            main.postDelayed(this,2400)
        }
    }
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        if (!TrackingPrefs(this).disclosureAccepted) { finish(); return }
        startedAt=System.currentTimeMillis()
        enabledAtLaunch=Health.serviceEnabled(this)
        settingsOpened=savedInstanceState?.getBoolean("settingsOpened") ?: false
        window.statusBarColor=Color.BLACK
        window.navigationBarColor=Color.BLACK
        content=GuideVideoPlayer(this)
        setContentView(content)
        main.postDelayed(advance,2400)
    }
    override fun onResume() {
        super.onResume()
        // Request PiP only from a resumed activity, after its first frame.
        main.postDelayed({
            if (!isFinishing && !settingsOpened && !pipRequested) openSettingsWithGuide()
        },250)
    }
    private fun openSettingsWithGuide() {
        pipRequested=true
        if(Build.VERSION.SDK_INT>=26 && packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) {
            val requested=runCatching {
                enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(640,592)).build())
            }.onFailure { Log.w("DriftlessGuide","PiP request failed",it) }.getOrDefault(false)
            if(requested) {
                // PiP is asynchronous. Opening Settings before its callback replaces the guide.
                main.postDelayed({
                    if (!isFinishing && !settingsOpened) {
                        enteredPip=isInPictureInPictureMode
                        launchSettingsSeparately()
                    }
                },1000)
                return
            }
        }
        launchSettingsSeparately()
    }
    private fun launchSettingsSeparately() {
        if(settingsOpened || isFinishing) return
        settingsOpened=true
        try {
            // Settings must never be pushed into the guide's pinned task.
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            Log.i("DriftlessGuide","Settings opened in separate task; floatingGuide=$enteredPip")
        } catch (e:RuntimeException) {
            Log.w("DriftlessGuide","Cannot open Accessibility Settings",e)
            finish(); return
        }
        if(!enteredPip) finish()
    }
    override fun onPictureInPictureModeChanged(inPip:Boolean,newConfig:Configuration) {
        super.onPictureInPictureModeChanged(inPip,newConfig)
        if(inPip) {
            enteredPip=true
            main.post { launchSettingsSeparately() }
        } else if(enteredPip && settingsOpened) finish()
    }
    override fun onStart() {
        super.onStart()
        if (::content.isInitialized) content.playing=true
    }
    override fun onStop() {
        if (::content.isInitialized && !isInPictureInPictureMode) content.playing=false
        super.onStop()
    }
    override fun onSaveInstanceState(outState:Bundle) {
        outState.putBoolean("settingsOpened",settingsOpened); super.onSaveInstanceState(outState)
    }
    override fun onDestroy() { main.removeCallbacksAndMessages(null); super.onDestroy() }
}
