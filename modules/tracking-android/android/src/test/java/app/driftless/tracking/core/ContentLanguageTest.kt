package app.driftless.tracking.core

import org.junit.Assert.*
import org.junit.Test

class ContentLanguageTest {
    @Test fun detectsSupportedNativeScriptsAndFallsBackForRomanizationOrAmbiguity() {
        for((language,text) in mapOf("te" to "తెలుగు కథలు చూస్తున్నావా", "hi" to "हिन्दी कहानी देख रहे हो",
            "ta" to "தமிழ் கதைகள் பார்க்கலாம்", "kn" to "ಕನ್ನಡ ಕಥೆಗಳು ನೋಡೋಣ", "ml" to "മലയാളം കഥകൾ കാണാം")) {
            assertEquals(language,detectContentLanguage(listOf("@creator #reels",text)))
        }
        assertNull(detectContentLanguage(emptyList()))
        assertNull(detectContentLanguage(listOf("inka okka reel bro #telugu")))
        assertNull(detectContentLanguage(listOf("bas ek aur bro #hinglish")))
        assertNull(detectContentLanguage(listOf("తెలు")))
        assertNull(detectContentLanguage(listOf("కకకక कककक")))
        assertNull(detectContentLanguage(listOf("౧౨౩౪౫")))
        assertNull(detectContentLanguage(listOf("x".repeat(4096),"కకకకకకకక")))
        assertEquals("te",detectContentLanguage(listOf("Hello #shorts కకకకకకకక கககக")))
    }
    private val rules = AppRules("com.example.video","Example",setOf("pager"),
        listOf(ItemPart("player",Field.CAPTION_TEXT)),emptySet(),emptySet(),emptyList(),
        captionDescriptionViewIds=setOf("metadata"))
    private val salt=ByteArray(16){7}
    private fun screen(vararg children: FakeNode) = FakeNode(viewId="pager",children=children.toList())
    @Test fun onlyInspectsVisibleConfiguredPlayerMetadataAndDoesNotChangeClassification() {
        val player=FakeNode(viewId="player",children=listOf(
            FakeNode(className="TextView",text="తెలుగు కథలు చూస్తున్నావా"),
            FakeNode(className="Button",text="हिन्दी हिन्दी हिन्दी हिन्दी")))
        val tree=screen(player,FakeNode(text="മലയാളം മലയാളം മലയാളം"))
        val ordinary=Classifier().classify(tree,rules,salt)
        val withLanguage=Classifier().classify(tree,rules,salt,detectLanguage=true)
        assertEquals("te",withLanguage.contentLanguage)
        assertEquals(ordinary,withLanguage.copy(contentLanguage=null))
        assertNull(ordinary.contentLanguage)
        assertNull(Classifier().classify(screen(FakeNode(viewId="player",children=listOf(
            FakeNode(text="కకకకకక",isVisible=false),FakeNode(text="कककककक",className="EditText")))),rules,salt,true).contentLanguage)
        assertNull(Classifier().classify(FakeNode(children=listOf(player)),rules,salt,true).contentLanguage)
        assertNull(Classifier().classify(null,rules,salt,true).contentLanguage)
    }
    @Test fun descriptionsOutsideTheMetadataPanelAndAdsAreNotLanguageSources() {
        val unconfigured=screen(FakeNode(viewId="player",contentDesc="తెలుగు కథలు చూస్తున్నావా"))
        assertNull(Classifier().classify(unconfigured,rules,salt,true).contentLanguage)
        val configured=screen(FakeNode(viewId="player",children=listOf(
            FakeNode(viewId="metadata",contentDesc="తెలుగు కథలు చూస్తున్నావా"))))
        assertEquals("te",Classifier().classify(configured,rules,salt,true).contentLanguage)
        val adRules=rules.copy(adViewIds=setOf("ad"))
        val ad=screen(FakeNode(viewId="player",children=listOf(
            FakeNode(text="తెలుగు కథలు చూస్తున్నావా"),FakeNode(viewId="ad"))))
        assertNull(Classifier().classify(ad,adRules,salt,true).contentLanguage)
    }
}
