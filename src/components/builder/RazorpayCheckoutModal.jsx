// In-app Razorpay Standard Checkout for a builder plan — the same checkout.js
// and the same options as web subscription/subscriptionCheckout.js, run inside
// a WebView so it works in Expo Go and in builds without a native Razorpay SDK.
//
// Exactly one callback runs, as on the web:
//   onSuccess({ razorpay_payment_id, razorpay_order_id, razorpay_signature })
//   onFailure({ code, description, paymentId })
//   onDismiss()
//   onUnavailable()   checkout.js could not load (offline / blocked): the caller
//                     falls back to the web Plan & billing page.
// Checkout's success is only Checkout's word: the caller verifies it with
// POST /subscriptions/verify, and only the server's answer activates a plan.
//
// Needs react-native-webview (in Expo Go):  npx expo install react-native-webview
import { useEffect, useMemo, useRef } from 'react'
import { Modal, View, Text, Pressable, ActivityIndicator, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { WEB_BASE_URL } from '../../api/subscription'
import { useLanguage } from '../../i18n/LanguageContext'

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

function checkoutHtml(order, description) {
  // The order's public key id and amounts come from the server's order answer.
  const options = {
    key: order.key_id,
    order_id: order.razorpay_order_id,
    amount: order.amount_paise,
    currency: order.currency,
    name: 'CREWNBUILD',
    description: `${description} · TEST MODE`,
    prefill: { name: order.customer_name || '', email: order.customer_email || '' },
    notes: { purpose: 'builder_subscription', plan: order.plan_code, duration: order.duration_code, mode: 'test' },
    theme: { color: '#0f766e' },
  }
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#f8fafc;font-family:-apple-system,Roboto,sans-serif}</style></head>
<body><script>
function post(type, payload) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || null })) }
var settled = false
function once(type, payload) { if (settled) return; settled = true; post(type, payload) }
var script = document.createElement('script')
script.src = ${JSON.stringify(CHECKOUT_SCRIPT)}
script.onerror = function () { once('unavailable') }
script.onload = function () {
  try {
    var options = ${JSON.stringify(options)}
    options.handler = function (response) { once('success', response) }
    options.modal = { ondismiss: function () { once('dismiss') } }
    var checkout = new window.Razorpay(options)
    checkout.on('payment.failed', function (response) {
      var error = (response && response.error) || {}
      once('failure', { code: error.code, description: error.description, paymentId: error.metadata && error.metadata.payment_id })
      try { checkout.close() } catch (e) {}
    })
    checkout.open()
    post('opened')
  } catch (e) { once('unavailable') }
}
document.body.appendChild(script)
</script></body></html>`
}

export default function RazorpayCheckoutModal({ order, description, onSuccess, onFailure, onDismiss, onUnavailable }) {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const settled = useRef(false)
  // Each new order gets its own single outcome (the modal stays mounted between payments).
  useEffect(() => { settled.current = false }, [order])
  const html = useMemo(() => (order ? checkoutHtml(order, description || '') : ''), [order, description])
  if (!order) return null

  const finish = (callback, payload) => {
    if (settled.current) return
    settled.current = true
    callback?.(payload)
  }

  const onMessage = (event) => {
    let message = null
    try { message = JSON.parse(event.nativeEvent.data) } catch { return }
    if (message?.type === 'success') finish(onSuccess, message.payload || {})
    else if (message?.type === 'failure') finish(onFailure, message.payload || {})
    else if (message?.type === 'dismiss') finish(onDismiss)
    else if (message?.type === 'unavailable') finish(onUnavailable)
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => finish(onDismiss)}>
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#f8fafc' }}>
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <Text className="text-[15px] font-extrabold text-graphite">{t('mobile.billing.checkout.title')}</Text>
          <Pressable onPress={() => finish(onDismiss)} accessibilityLabel={t('mobile.billing.checkout.close')} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <X size={18} color="#334155" />
          </Pressable>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: WEB_BASE_URL || 'https://crewnbuild.com' }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator color="#134127" />
            </View>
          )}
          onError={() => finish(onUnavailable)}
          // UPI and bank-app links (upi://, intent://, tez://…) open the app on
          // the phone; ordinary pages stay inside the checkout.
          onShouldStartLoadWithRequest={(request) => {
            const url = String(request?.url || '')
            if (/^(https?:|about:|data:|blob:)/i.test(url)) return true
            Linking.openURL(url).catch(() => {})
            return false
          }}
          style={{ flex: 1, backgroundColor: '#f8fafc' }}
        />
      </View>
    </Modal>
  )
}
