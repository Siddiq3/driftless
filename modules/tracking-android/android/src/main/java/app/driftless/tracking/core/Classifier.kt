package app.driftless.tracking.core

/**
 * Minimal read-only view of an accessibility node. The Android adapter wraps
 * AccessibilityNodeInfo; tests use [FakeNode]. Text and descriptions are only ever read here, in
 * memory, to compute a fingerprint or match an ad label — they are never stored or logged.
 */
interface UiNode {
    /** Resource name without the package prefix, e.g. "reel_recycler". */
    val viewId: String?
    val className: String?
    val contentDesc: String?
    val text: String?
    val isVisible: Boolean
    val childCount: Int
    fun child(i: Int): UiNode?
}

/** Which node attribute contributes to the item fingerprint. */
enum class Field { CONTENT_DESC, TEXT, CAPTION_TEXT }

data class ItemPart(val viewId: String, val field: Field)

/**
 * Detection rules for one supported app. Shipped in a versioned data file so they can be updated
 * when the target app changes its UI. `validatedVersions` lists app version prefixes that passed
 * the labelled accuracy gate (G-2); outside them counts are reported as unvalidated.
 */
data class AppRules(
    val pkg: String,
    val label: String,
    val surfaceViewIds: Set<String>,
    val itemParts: List<ItemPart>,
    val adViewIds: Set<String>,
    val adLabels: Set<String>,
    val validatedVersions: List<String>,
)

data class RuleSet(val version: Int, val apps: Map<String, AppRules>)

data class Classification(val surface: Surface, val fingerprint: String?, val isAd: Boolean, val nodesVisited: Int, val itemContainerPresent: Boolean = true)

class Classifier(private val maxNodes: Int = MAX_NODES, private val maxDepth: Int = MAX_DEPTH) {

    fun classify(root: UiNode?, rules: AppRules, salt: ByteArray): Classification {
        if (root == null) return Classification(Surface.UNKNOWN, null, isAd = false, nodesVisited = 0)
        var surface = false
        var ad = false
        val parts = HashMap<ItemPart, String>()
        var visited = 0
        val containers = HashSet<String>()
        var playerControlsPresent = false

        // Breadth-first, bounded: never walk an unbounded tree on the UI-event hot path.
        data class Work(val node: UiNode, val depth: Int, val scopes: Set<ItemPart>, val controls: Boolean)
        val captions = HashMap<ItemPart, LinkedHashSet<String>>()
        val queue = ArrayDeque<Work>()
        queue.addLast(Work(root, 0, emptySet(), false))
        while (queue.isNotEmpty() && visited < maxNodes) {
            val (n, depth, inheritedScopes, insideControl) = queue.removeFirst()
            visited++
            if (!n.isVisible) continue
            val cls = n.className?.substringAfterLast('.')
            val controls = insideControl || cls in setOf("Button", "ImageButton", "RadioButton", "CheckBox", "Switch", "SeekBar")
            val id = n.viewId
            val scopes = inheritedScopes + rules.itemParts.filter { it.viewId == id && it.field == Field.CAPTION_TEXT }
            if (scopes.isNotEmpty() && cls in setOf("Button", "ImageButton", "RadioButton", "CheckBox", "Switch"))
                playerControlsPresent = true
            // YouTube's anonymous caption groups carry text, while buttons contain changing
            // likes/playback labels. Never use those controls or content outside the player.
            if (!controls && scopes.isNotEmpty()) {
                val text = n.text?.trim()?.take(512)
                if (!text.isNullOrEmpty()) scopes.forEach { captions.getOrPut(it) { linkedSetOf() }.add(text) }
            }
            if (id != null) {
                if (rules.itemParts.any { it.viewId == id }) containers.add(id)
                if (id in rules.surfaceViewIds) surface = true
                if (id in rules.adViewIds) ad = true
                for (p in rules.itemParts) {
                    if (p.viewId == id && p !in parts) {
                        val v = when (p.field) {
                            Field.CONTENT_DESC -> n.contentDesc
                            Field.TEXT -> n.text
                            Field.CAPTION_TEXT -> null
                        }
                        if (!v.isNullOrBlank()) parts[p] = v.trim()
                    }
                }
            }
            if (!ad && rules.adLabels.isNotEmpty()) {
                val label = (n.text ?: n.contentDesc)?.trim()?.lowercase()
                if (label != null && label in rules.adLabels) ad = true
            }
            if (depth < maxDepth) {
                for (i in 0 until n.childCount) n.child(i)?.let { queue.addLast(Work(it, depth + 1, scopes, controls)) }
            }
        }

        captions.forEach { (part, text) -> if (text.isNotEmpty()) parts[part] = text.joinToString("\n") }
        if (!surface) return Classification(Surface.OTHER, null, isAd = false, nodesVisited = visited)
        // Identity needs every configured part; a partial match would merge different items.
        val fp =
            if (rules.itemParts.isNotEmpty() && parts.size == rules.itemParts.size) {
                Fingerprint.of(salt, rules.itemParts.map { parts.getValue(it) })
            } else {
                null
            }
        return Classification(Surface.SHORT_VIDEO, fp, ad, visited,
            if (rules.itemParts.any { it.field == Field.CAPTION_TEXT }) playerControlsPresent
            else rules.itemParts.isNotEmpty() && rules.itemParts.all { it.viewId in containers })
    }

    companion object {
        const val MAX_NODES = 600
        const val MAX_DEPTH = 40
    }
}

/** Test double and debug helper. */
data class FakeNode(
    override val viewId: String? = null,
    override val className: String? = null,
    override val contentDesc: String? = null,
    override val text: String? = null,
    override val isVisible: Boolean = true,
    val children: List<FakeNode> = emptyList(),
) : UiNode {
    override val childCount: Int get() = children.size
    override fun child(i: Int): UiNode? = children.getOrNull(i)
}

/** Version gate: is the installed app version covered by validated rules? */
fun isValidatedVersion(rules: AppRules, appVersion: String?): Boolean =
    appVersion != null && rules.validatedVersions.any { appVersion == it || appVersion.startsWith("$it.") }
