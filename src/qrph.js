// PayMongo QRPh — mirrors js/reservation.js on the website. The
// amount-bearing Payment Intent is created server-side by the same Google
// Apps Script used for voucher emails (it holds the PayMongo Secret key,
// which must never live in this app's JS). Payment-method creation + attach
// only need the Public key, so those happen directly here.
const VOUCHER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwkaT0m8W5Q0HEAH6aNGZqibNgfXkJzUGzp28Txo2RyOPEenGtmujWaS2EEgJu7dhz3/exec";
const VOUCHER_SECRET = "lA6grkC0pujbOn5B5ooSip3z9N-Wvwre";

const PAYMONGO_PUBLIC_KEY = "pk_live_REoKKSMaQ8TE6uihC9jwtWiS";

async function callVoucherEndpoint(payload) {
  const res = await fetch(VOUCHER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: VOUCHER_SECRET, ...payload }),
  });
  return res.json();
}

async function paymongoRequest(path, body) {
  const res = await fetch("https://api.paymongo.com/v1" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(PAYMONGO_PUBLIC_KEY + ":"),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json.errors && json.errors[0] && json.errors[0].detail) || "PayMongo error");
  }
  return json;
}

// Creates the Payment Intent (server-side, via Apps Script) then immediately
// creates + attaches a qrph payment method (client-side, Public key) and
// returns the QR image to display.
export async function startQrphPayment(amount, description) {
  const created = await callVoucherEndpoint({ action: "createQrPayment", amount, description });
  if (!created.ok) throw new Error(created.error || "createQrPayment failed");

  const pm = await paymongoRequest("/payment_methods", { data: { attributes: { type: "qrph" } } });

  const attached = await paymongoRequest(`/payment_intents/${created.id}/attach`, {
    data: { attributes: { payment_method: pm.data.id, client_key: created.clientKey } },
  });

  const imageUrl = attached.data.attributes.next_action &&
    attached.data.attributes.next_action.code &&
    attached.data.attributes.next_action.code.image_url;
  if (!imageUrl) throw new Error("No QR image returned");

  return { id: created.id, imageUrl };
}

export async function checkQrphStatus(id) {
  const check = await callVoucherEndpoint({ action: "checkQrPaymentStatus", id });
  if (!check.ok) throw new Error(check.error || "checkQrPaymentStatus failed");
  return check.status;
}
