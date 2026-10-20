export async function onRequestPost({ request, env }) {
  // 프로덕션 전환 시 Cloudflare 환경변수 MAYA_BASE 를
  // https://pg.paymaya.com/checkout/v1/checkouts 로만 바꾸면 됩니다.
  const MAYA_BASE = env.MAYA_BASE || 'https://pg.paymaya.com/checkout/v1/checkouts';

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  if (!env.VOUCHER_SECRET || body.secret !== env.VOUCHER_SECRET) {
    return json({ ok: false, error: 'invalid_secret' }, 403);
  }
  if (!body.checkoutId) {
    return json({ ok: false, error: 'missing_checkoutId' }, 400);
  }

  const res = await fetch(`${MAYA_BASE}/${encodeURIComponent(body.checkoutId)}`, {
    headers: { Authorization: 'Basic ' + btoa(env.MAYA_SECRET_KEY + ':') }
  });

  const text = await res.text();
  let maya;
  try {
    maya = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'maya_non_json', httpStatus: res.status }, 502);
  }
  if (!res.ok) return json({ ok: false, error: maya.error || 'maya_error' }, 502);

  return json({
    ok: true,
    status: maya.status || '',
    paymentStatus: maya.paymentStatus || ''
  });
}
