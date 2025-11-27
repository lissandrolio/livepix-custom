import axios from "axios";
import QRCode from "qrcode";

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    const nome = body.nome;
    const mensagem = body.mensagem;
    const valor = body.valor;

    // 1 — Gerar token do LivePix
    const tokenResp = await axios.post(
      process.env.LIVEPIX_TOKEN_URL,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.LIVEPIX_CLIENT_ID + ":" + process.env.LIVEPIX_CLIENT_SECRET
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const token = tokenResp.data.access_token;

    // 2 — Criar Cobrança
    const chargeResp = await axios.post(
      process.env.LIVEPIX_CHARGE_URL,
      {
        amount: valor,
        description: mensagem,
        payer: { name: nome },
        reference_id: "ref_" + Date.now(),
      },
      {
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      }
    );

    const pixString =
      chargeResp.data.pix?.qr_code ||
      chargeResp.data.qrPayload ||
      chargeResp.data.payment_uri ||
      null;

    const qrDataUrl = await QRCode.toDataURL(pixString);

    return {
      statusCode: 200,
      body: JSON.stringify({
        pixString,
        qrDataUrl,
        charge: chargeResp.data,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: true,
        details: err.response?.data || err.message,
      }),
    };
  }
}
