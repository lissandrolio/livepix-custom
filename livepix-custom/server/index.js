// server/index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');

const app = express();
app.use(bodyParser.json());

// Config via .env
const CLIENT_ID = process.env.LIVEPIX_CLIENT_ID;
const CLIENT_SECRET = process.env.LIVEPIX_CLIENT_SECRET;
// Troque estas URLs pelos endpoints reais do LivePix (veja docs)
const TOKEN_URL = process.env.LIVEPIX_TOKEN_URL || 'https://api.livepix.example/oauth/token';
const CREATE_CHARGE_URL = process.env.LIVEPIX_CREATE_CHARGE_URL || 'https://api.livepix.example/charges';
const PORT = process.env.PORT || 3000;

/*
  Função: obter token (exemplo OAuth2 client_credentials)
  Ajuste conforme o fluxo do LivePix (algumas APIs usam API Key diretamente).
*/
async function getAccessToken() {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  try {
    const resp = await axios.post(TOKEN_URL, 'grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return resp.data.access_token;
  } catch (err) {
    console.error('Erro obtendo token:', err.response?.data || err.message);
    throw err;
  }
}

// Endpoint que o frontend chama para criar cobrança/pix dinâmico
app.post('/create-charge', async (req, res) => {
  try {
    const { nome, mensagem, valor } = req.body; // valor em centavos ou conforme API
    if (!valor || isNaN(valor)) return res.status(400).json({ error: 'Valor inválido' });

    const token = await getAccessToken();

    // Ajuste o payload conforme requisitos do LivePix
    const payload = {
      amount: valor, // Ex.: 100 = R$1,00 (depende da API)
      reference_id: `pedido_${Date.now()}`,
      payer: { name: nome || 'Cliente' },
      description: mensagem || 'Pagamento via Pix',
      // outros campos da API LivePix...
    };

    const createResp = await axios.post(CREATE_CHARGE_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const chargeData = createResp.data;
    // Supondo que a API retorne um campo com string do payload do QR ou URI do Pix
    // Exemplo: chargeData.pix.qr_code ou chargeData.payment_uri
    const pixString = chargeData.pix?.qr_code || chargeData.payment_uri || chargeData.qrPayload;

    // Gerar image dataURL do QR localmente (opcional)
    let qrDataUrl = null;
    if (pixString) {
      qrDataUrl = await QRCode.toDataURL(pixString);
    }

    // Retorna ao frontend detalhes da cobrança
    res.json({
      charge: chargeData,
      pixString,
      qrDataUrl
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao criar cobrança', detail: err.response?.data || err.message });
  }
});

// Webhook endpoint para receber confirmação de pagamento do LivePix
// Configure a URL deste endpoint no painel LivePix
app.post('/webhook', (req, res) => {
  // Aqui você valida assinatura (se existir) e atualiza seu DB
  console.log('Webhook recebido:', JSON.stringify(req.body, null, 2));
  // TODO: validar assinatura (x-signature, etc) conforme LivePix docs
  // Atualizar pedido no banco, marcar como pago, enviar e-mail, etc.
  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`Server rodando na porta ${PORT}`));
