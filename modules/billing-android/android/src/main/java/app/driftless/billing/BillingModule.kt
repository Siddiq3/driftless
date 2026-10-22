package app.driftless.billing

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin bridge to Google Play Billing. It only obtains purchase tokens; the server verifies them and
 * decides entitlement (THREAT_MODEL T5). Purchases are acknowledged by the server, not here.
 */
class BillingModule : Module() {
    private var client: BillingClient? = null
    private var pendingPurchase: Promise? = null
    private val details = HashMap<String, ProductDetails>()

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        val p = pendingPurchase ?: return@PurchasesUpdatedListener
        pendingPurchase = null
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val purchase = purchases?.firstOrNull()
                if (purchase == null) p.reject(CodedException("NO_PURCHASE", "No purchase returned", null))
                else p.resolve(toMap(purchase))
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> p.reject(CodedException("USER_CANCELED", "Purchase cancelled", null))
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> p.reject(CodedException("ALREADY_OWNED", "Already subscribed — use Restore", null))
            else -> p.reject(CodedException("BILLING_${result.responseCode}", result.debugMessage, null))
        }
    }

    private fun toMap(p: Purchase) = mapOf(
        "purchaseToken" to p.purchaseToken,
        "products" to p.products,
        "state" to when (p.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> "purchased"
            Purchase.PurchaseState.PENDING -> "pending"
            else -> "unspecified"
        },
        "acknowledged" to p.isAcknowledged,
    )

    private fun connected(onReady: (BillingClient) -> Unit, onError: (CodedException) -> Unit) {
        val ctx = appContext.reactContext ?: return onError(CodedException("NO_CONTEXT", "React context unavailable", null))
        val c = client ?: BillingClient.newBuilder(ctx)
            .setListener(purchasesListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
            .also { client = it }
        if (c.isReady) return onReady(c)
        c.startConnection(
            object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) onReady(c)
                    else onError(CodedException("BILLING_UNAVAILABLE", result.debugMessage, null))
                }

                override fun onBillingServiceDisconnected() {
                    client = null // reconnect on next call
                }
            },
        )
    }

    override fun definition() = ModuleDefinition {
        Name("DriftlessBilling")

        /** Subscription offers for [productIds] with localized prices from Google Play. */
        AsyncFunction("getSubscriptions") { productIds: List<String>, promise: Promise ->
            connected({ c ->
                val params = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        productIds.map {
                            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.SUBS).build()
                        },
                    ).build()
                c.queryProductDetailsAsync(params) { result, queryResult ->
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        promise.reject(CodedException("BILLING_${result.responseCode}", result.debugMessage, null))
                        return@queryProductDetailsAsync
                    }
                    val list = queryResult.productDetailsList
                    list.forEach { details[it.productId] = it }
                    promise.resolve(
                        list.map { pd ->
                            mapOf(
                                "productId" to pd.productId,
                                "title" to pd.name,
                                "offers" to pd.subscriptionOfferDetails.orEmpty().map { o ->
                                    val phase = o.pricingPhases.pricingPhaseList.lastOrNull()
                                    mapOf(
                                        "offerToken" to o.offerToken,
                                        "basePlanId" to o.basePlanId,
                                        "price" to (phase?.formattedPrice ?: ""),
                                        "period" to (phase?.billingPeriod ?: ""),
                                        "phases" to o.pricingPhases.pricingPhaseList.map { price -> mapOf(
                                            "price" to price.formattedPrice,
                                            "period" to price.billingPeriod,
                                            "cycles" to price.billingCycleCount,
                                            "mode" to price.recurrenceMode,
                                        ) },
                                    )
                                },
                            )
                        },
                    )
                }
            }, { promise.reject(it) })
        }

        /** Opens the Google Play purchase sheet. [accountId] must be the server's obfuscated id for this user. */
        AsyncFunction("purchase") { productId: String, offerToken: String, accountId: String, promise: Promise ->
            val activity = appContext.currentActivity
                ?: return@AsyncFunction promise.reject(CodedException("NO_ACTIVITY", "No foreground activity", null))
            val pd = details[productId]
                ?: return@AsyncFunction promise.reject(CodedException("UNKNOWN_PRODUCT", "Load subscriptions first", null))
            if (pendingPurchase != null) return@AsyncFunction promise.reject(CodedException("IN_PROGRESS", "A purchase is already open", null))
            connected({ c ->
                pendingPurchase = promise
                val params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(
                        listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).setOfferToken(offerToken).build()),
                    )
                    .setObfuscatedAccountId(accountId)
                    .build()
                val r = c.launchBillingFlow(activity, params)
                if (r.responseCode != BillingClient.BillingResponseCode.OK) {
                    pendingPurchase = null
                    promise.reject(CodedException("BILLING_${r.responseCode}", r.debugMessage, null))
                }
            }, { promise.reject(it) })
        }

        /** Active subscriptions on this Google account (for Restore). */
        AsyncFunction("activeSubscriptions") { promise: Promise ->
            connected({ c ->
                c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()) { result, purchases ->
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        promise.reject(CodedException("BILLING_${result.responseCode}", result.debugMessage, null))
                    } else {
                        promise.resolve(purchases.map { toMap(it) })
                    }
                }
            }, { promise.reject(it) })
        }

        OnDestroy {
            client?.endConnection()
            client = null
        }
    }
}
