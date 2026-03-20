import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function sendROIEmail(tenantEmail: string, tenantId: string, weekLabel: string, data: {
  weeklyCalls: number; weeklyBookings: number; weeklyYield: string
  monthlyCalls: number; monthlyBookings: number; monthlyYield: string; monthlyRevenue: string
}) {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body style='margin:0;padding:0;background:#0D1A0D;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#0D1A0D;padding:40px 20px;'>
    <tr><td align='center'>
      <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%;'>

        <tr><td style='background:linear-gradient(135deg,#101f10,#0D1A0D);border:1px solid rgba(168,255,71,0.2);border-radius:16px 16px 0 0;padding:32px 36px 24px;'>
          <p style='margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#71717a;'>REVENUECS</p>
          <h1 style='margin:0 0 4px;font-size:26px;font-weight:700;color:#fafafa;'>Weekly ROI Report</h1>
          <p style='margin:0;font-size:13px;color:#71717a;'>${weekLabel}</p>
        </td></tr>

        <tr><td style='background:#101f10;border-left:1px solid rgba(168,255,71,0.2);border-right:1px solid rgba(168,255,71,0.2);padding:24px 36px;'>
          <table width='100%' cellpadding='0' cellspacing='0'>
            <tr>
              <td width='33%' style='padding-right:8px;'>
                <div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;text-align:center;'>
                  <p style='margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#71717a;'>BI-WEEKLY CALLS</p>
                  <p style='margin:0;font-size:28px;font-weight:700;color:#fafafa;'>${data.weeklyCalls}</p>
                </div>
              </td>
              <td width='33%' style='padding:0 4px;'>
                <div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;text-align:center;'>
                  <p style='margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#71717a;'>BOOKINGS</p>
                  <p style='margin:0;font-size:28px;font-weight:700;color:#A8FF47;'>${data.weeklyBookings}</p>
                </div>
              </td>
              <td width='33%' style='padding-left:8px;'>
                <div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;text-align:center;'>
                  <p style='margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#71717a;'>SALES YIELD</p>
                  <p style='margin:0;font-size:28px;font-weight:700;color:#A8FF47;'>${data.weeklyYield}%</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style='background:#101f10;border-left:1px solid rgba(168,255,71,0.2);border-right:1px solid rgba(168,255,71,0.2);padding:0 36px 24px;'>
          <div style='background:rgba(168,255,71,0.06);border:1px solid rgba(168,255,71,0.2);border-radius:12px;padding:20px 24px;'>
            <p style='margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#71717a;'>30-DAY PERFORMANCE</p>
            <table width='100%'>
              <tr>
                <td style='font-size:13px;color:#a1a1aa;padding-bottom:8px;'>Total Calls</td>
                <td align='right' style='font-size:13px;font-weight:600;color:#fafafa;'>${data.monthlyCalls}</td>
              </tr>
              <tr>
                <td style='font-size:13px;color:#a1a1aa;padding-bottom:8px;'>Confirmed Bookings</td>
                <td align='right' style='font-size:13px;font-weight:600;color:#A8FF47;'>${data.monthlyBookings}</td>
              </tr>
              <tr>
                <td style='font-size:13px;color:#a1a1aa;padding-bottom:8px;'>Gross Yield</td>
                <td align='right' style='font-size:13px;font-weight:600;color:#A8FF47;'>${data.monthlyYield}%</td>
              </tr>
              <tr>
                <td style='font-size:13px;color:#a1a1aa;'>Total Revenue</td>
                <td align='right' style='font-size:15px;font-weight:700;color:#A8FF47;'>$${data.monthlyRevenue}</td>
              </tr>
            </table>
          </div>
        </td></tr>

        <tr><td style='background:#0D1A0D;border:1px solid rgba(168,255,71,0.2);border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;'>
          <p style='margin:0;font-size:12px;color:#52525b;'>RevenueCS &middot; revenuecs.com &middot; Weekly automated report</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'RevenueCS <onboarding@resend.dev>',
      to: [tenantEmail],
      subject: `Weekly ROI Report — ${weekLabel}`,
      html,
    }),
  })
  return res.ok
}

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const sql = getSql()
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 14)
  const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 30)
  const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' – ' + now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Get all onboarded tenants
  const tenants = await sql`
    SELECT id, email FROM tenants WHERE onboarding_complete = true`

  const results: { email: string; sent: boolean }[] = []

  for (const tenant of tenants as { id: string; email: string }[]) {
    try {
      const [wc, wb, mc, mb, mr] = await Promise.all([
        sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenant.id} AND created_at >= ${weekStart.toISOString()}`,
        sql`SELECT COUNT(*)::int AS c FROM bookings WHERE tenant_id = ${tenant.id} AND created_at >= ${weekStart.toISOString()} AND status != 'cancelled'`,
        sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenant.id} AND created_at >= ${monthStart.toISOString()}`,
        sql`SELECT COUNT(*)::int AS c FROM bookings WHERE tenant_id = ${tenant.id} AND created_at >= ${monthStart.toISOString()} AND status != 'cancelled'`,
        sql`SELECT COALESCE(SUM(value_cents),0)::int AS rev FROM bookings WHERE tenant_id = ${tenant.id} AND created_at >= ${monthStart.toISOString()} AND status != 'cancelled'`,
      ])

      const weeklyCalls = (wc as {c:number}[])[0].c
      const weeklyBookings = (wb as {c:number}[])[0].c
      const monthlyCalls = (mc as {c:number}[])[0].c
      const monthlyBookings = (mb as {c:number}[])[0].c
      const monthlyRevenue = ((mr as {rev:number}[])[0].rev / 100).toFixed(2)
      const weeklyYield = weeklyCalls > 0 ? ((weeklyBookings / weeklyCalls) * 100).toFixed(1) : '0.0'
      const monthlyYield = monthlyCalls > 0 ? ((monthlyBookings / monthlyCalls) * 100).toFixed(1) : '0.0'

      const sent = await sendROIEmail(tenant.email, tenant.id, weekLabel, {
        weeklyCalls, weeklyBookings, weeklyYield,
        monthlyCalls, monthlyBookings, monthlyYield, monthlyRevenue,
      })

      results.push({ email: tenant.email, sent })
    } catch (err) {
      console.error(`[weekly-roi] failed for ${tenant.email}:`, err)
      results.push({ email: tenant.email, sent: false })
    }
  }

  return NextResponse.json({ ok: true, sent: results.length, results })
}
