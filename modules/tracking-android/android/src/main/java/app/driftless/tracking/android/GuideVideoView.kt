package app.driftless.tracking.android

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class GuideVideoView(context:Context,appContext:AppContext):ExpoView(context,appContext) {
    override val shouldUseAndroidLayout=true
    private val video=GuideVideoPlayer(context)
    init { addView(video,LayoutParams(LayoutParams.MATCH_PARENT,LayoutParams.MATCH_PARENT)) }
    fun setSource(value:String) { video.setSource(value) }
    fun setPlaying(value:Boolean) { video.playing=value }
}
