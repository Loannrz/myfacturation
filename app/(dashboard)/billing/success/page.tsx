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

  let syncResult = { ok: false, reason: 'Session ou session_id manquant' } as Awaited<ReturnType<typeof syncUserFromStripeCheckout>>
  if (userId && sessionId && sessionId.startsWith('cs_')) {
    syncResult = await syncUserFromStripeCheckout(userId, sessionId)
  }

  return <BillingSuccessUI syncResult={syncResult} sessionId={sessionId} />
}
