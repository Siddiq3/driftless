package app.driftless.tracking.android

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import app.driftless.tracking.R

/** Bundled, muted looping video for onboarding and accessibility help. No network or capture. */
class GuideVideoPlayer(context: Context) : FrameLayout(context), TextureView.SurfaceTextureListener {
    private var videoResource=R.raw.accessibility_guide
    private var posterResource=R.drawable.accessibility_guide_poster
    private val texture=TextureView(context)
    private val poster=ImageView(context).apply {
        setImageResource(R.drawable.accessibility_guide_poster)
        scaleType=ImageView.ScaleType.FIT_CENTER
    }
    private var player:MediaPlayer?=null
    private var surface:Surface?=null
    private var prepared=false
    private var position=0
    var playing=true
        set(value) { field=value; updatePlayback() }
    init {
        setBackgroundColor(Color.BLACK)
        addView(texture,LayoutParams(-1,-1))
        addView(poster,LayoutParams(-1,-1))
        texture.surfaceTextureListener=this
        contentDescription="Video tutorial: Downloaded apps, ScrollSnooze, enable the switch, then Allow."
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_YES
    }
    fun setSource(source:String) {
        val reels=when(source) {
            "reels" -> true
            "accessibility" -> false
            else -> throw IllegalArgumentException("Unknown bundled video")
        }
        val next=if(reels) R.raw.onboarding_reels else R.raw.accessibility_guide
        if(next==videoResource) return
        release(); position=0
        videoResource=next
        posterResource=if(reels) R.drawable.onboarding_reels_poster else R.drawable.accessibility_guide_poster
        poster.setImageResource(posterResource)
        contentDescription=if(reels) "Preview: six Reels scroll upward while the floating count increases." else "Video tutorial: Downloaded apps, ScrollSnooze, enable the switch, then Allow."
        if(texture.isAvailable) texture.surfaceTexture?.let { prepare(it) }
    }
    private fun motionEnabled()=Build.VERSION.SDK_INT<26 || ValueAnimator.areAnimatorsEnabled()
    private fun updatePlayback() {
        val p=player ?: return
        if(!prepared) return
        if(playing && motionEnabled()) { p.start(); poster.visibility=View.GONE }
        else { if(p.isPlaying) p.pause() }
    }
    private fun prepare(st:SurfaceTexture) {
        if(player!=null) return
        surface=Surface(st)
        player=MediaPlayer().apply {
            setSurface(surface)
            setDataSource(context,Uri.parse("android.resource://${context.packageName}/${videoResource}"))
            isLooping=true; setVolume(0f,0f)
            setOnPreparedListener { prepared=true; if(position>0) it.seekTo(position); updatePlayback() }
            setOnErrorListener { _,_,_ -> poster.visibility=View.VISIBLE; true }
            prepareAsync()
        }
    }
    private fun release() {
        player?.let { p -> if(prepared) position=runCatching {p.currentPosition}.getOrDefault(0); p.release() }
        player=null; prepared=false; surface?.release(); surface=null
        poster.visibility=View.VISIBLE
    }
    override fun onSurfaceTextureAvailable(st:SurfaceTexture,w:Int,h:Int) { prepare(st) }
    override fun onSurfaceTextureSizeChanged(st:SurfaceTexture,w:Int,h:Int) {}
    override fun onSurfaceTextureDestroyed(st:SurfaceTexture):Boolean { release(); return true }
    override fun onSurfaceTextureUpdated(st:SurfaceTexture) {}
    override fun onAttachedToWindow() { super.onAttachedToWindow(); if(texture.isAvailable) texture.surfaceTexture?.let {prepare(it)} }
    override fun onDetachedFromWindow() { release(); super.onDetachedFromWindow() }
}
