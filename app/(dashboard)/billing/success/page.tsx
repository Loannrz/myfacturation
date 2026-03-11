import { getSession } from '@/lib/auth'
import { syncUserFromStripeCheckout } from '@/lib/sync-stripe-checkout'
import { BillingSuccessUI } from './BillingSuccessUI'

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const sessionId = searchParams?.session_id ?? null
  const session = await getSession()
  const userId = session?.user?.id ?? null

  // #region agent log
  fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'billing/success/page.tsx:entry',message:'success page server',data:{hasUserId:!!userId,hasSessionId:!!sessionId,sessionIdPrefix:sessionId?.slice(0,9)??null},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  let syncResult = { ok: false, reason: 'Session ou session_id manquant' } as Awaited<ReturnType<typeof syncUserFromStripeCheckout>>
  if (userId && sessionId && sessionId.startsWith('cs_')) {
    syncResult = await syncUserFromStripeCheckout(userId, sessionId)
  }

  // #region agent log
  fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42c834'},body:JSON.stringify({sessionId:'42c834',location:'billing/success/page.tsx:afterSync',message:'sync result',data:{syncOk:syncResult.ok,syncReason:(syncResult as {reason?:string}).reason},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return <BillingSuccessUI syncResult={syncResult} sessionId={sessionId} />
}
