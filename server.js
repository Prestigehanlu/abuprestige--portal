const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simulated local wallet
let userWallet = {
  phone: '08012345678',
  balance: 5000,
  pin: '1234'
};

// Plan mapping matching Arewagate's schema
const PLAN_MAP = {
  'mtn-sme-1gb': { network: 'mtn', plan_type: 'mtn-sme', plan_id: '457', cost: 290 },
  'mtn-sme-2gb': { network: 'mtn', plan_type: 'mtn-sme', plan_id: '458', cost: 580 },
  'mtn-sme-5gb': { network: 'mtn', plan_type: 'mtn-sme', plan_id: '459', cost: 1450 }
};

// Check Wallet Balance
app.get('/api/wallet', (req, res) => {
  res.json({ success: true, balance: userWallet.balance });
});

// Real Arewagate Token Fetcher
async function getArewagateToken() {
  const authRes = await axios.post('https://api.arewagate.com/api/v1/auth/token', {
    public_key: process.env.AREWAGATE_PUBLIC_KEY,
    secret_key: process.env.AREWAGATE_SECRET_KEY
  });
  return authRes.data.data?.token || authRes.data.access_token || authRes.data.token;
}

// Data Vending Route
app.post('/api/vend', async (req, res) => {
  const { planOrAmount, phone, pin } = req.body;

  // 1. PIN verification
  if (pin !== userWallet.pin) {
    return res.status(400).json({ success: false, message: 'Incorrect 4-digit PIN' });
  }

  const selectedPlan = PLAN_MAP[planOrAmount] || PLAN_MAP['mtn-sme-1gb'];

  // 2. Check local wallet balance
  if (userWallet.balance < selectedPlan.cost) {
    return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
  }

  try {
    // 3. Obtain Token from Arewagate
    const token = await getArewagateToken();

    // 4. Dispatch live order to Arewagate
    const idempotencyKey = crypto.randomUUID();
    const vendRes = await axios.post(
      'https://api.arewagate.com/api/v1/data-subscription/buy-data',
      {
        network: selectedPlan.network,
        plan_type: selectedPlan.plan_type,
        plan_id: selectedPlan.plan_id,
        phone_number: phone
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        }
      }
    );

    // 5. Deduct local balance upon provider acceptance
    userWallet.balance -= selectedPlan.cost;

    return res.json({
      success: true,
      message: vendRes.data.message || `Data successfully dispatched to ${phone}`,
      newBalance: userWallet.balance,
      reference: vendRes.data.data?.transaction_reference || vendRes.data.reference || idempotencyKey
    });

  } catch (err) {
    console.error('Arewagate API Error:', err.response?.data || err.message);
    const apiError = err.response?.data?.message || err.response?.data?.detail || 'Wholesale delivery error. Check Arewagate wallet balance.';
    return res.status(502).json({ success: false, message: apiError });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VTU Server running on port ${PORT}`);
});
