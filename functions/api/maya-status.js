export async function onRequestPost({ request, env }) {
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

  if (!env.MAYA_SECRET_KEY) {
    return json({ ok: false, error: 'missing_secret_key' }, 500);
  }

  // 대시보드에 붙여넣은 키에 공백·줄바꿈이 섞여 들어오는 일이 있다
  const auth = 'Basic ' + btoa(env.MAYA_SECRET_KEY.trim() + ':');

  let res;
  try {
    res = await fetch(`${MAYA_BASE}/${encodeURIComponent(body.checkoutId)}`, {
      headers: { Authorization: auth }
    });
  } catch (err) {
    return json({ ok: false, error: 'maya_unreachable', detail: String((err && err.message) || err) }, 502);
  }

  const text = await res.text();
  let maya;
  try {
    maya = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'maya_non_json', httpStatus: res.status }, 502);
  }
  if (!res.ok) {
    return json({ ok: false, error: maya.error || 'maya_error', code: maya.code || '', httpStatus: res.status }, 502);
  }

  return json({
    ok: true,
    status: maya.status || '',
    paymentStatus: maya.paymentStatus || ''
  });
}
