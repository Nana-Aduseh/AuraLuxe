import { sendTxtConnectSms } from '@/lib/txtconnect'

type OrderSmsClient = {
  from: (table: string) => any
}

export async function sendOrderConfirmationSms(
  supabase: OrderSmsClient,
  order: Record<string, any>,
) {
  const checkoutPhone = order.guest_phone || order.phone || order.guest_info?.phone

  if (order.sms_sent_at || !checkoutPhone) {
    return
  }

  const customerName = order.guest_first_name || order.first_name || 'there'
  const message = `Hi ${customerName}, your order has been received. We will keep you updated on your delivery.\nThank you!`

  try {
    const result = await sendTxtConnectSms(checkoutPhone, message)

    if (!result.sent) {
      await supabase
        .from('orders')
        .update({ sms_status: result.reason })
        .eq('id', order.id)
      return
    }

    await supabase
      .from('orders')
      .update({
        sms_sent_at: new Date().toISOString(),
        sms_status: 'sent',
        sms_message_id: result.messageId,
        sms_error: null,
      })
      .eq('id', order.id)
      .is('sms_sent_at', null)
  } catch (error) {
    console.error('[Order SMS] Failed to send confirmation SMS:', error)
    await supabase
      .from('orders')
      .update({
        sms_status: 'failed',
        sms_error: error instanceof Error ? error.message : 'Unknown SMS error',
      })
      .eq('id', order.id)
  }
}