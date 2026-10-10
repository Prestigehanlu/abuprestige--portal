const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory user store for testing
let userWallet = {
  phone: '08012345678',
  balance: 5000,
  pin: '1234'
};

// Check Wallet Balance
app.get('/api/wallet', (req, res) => {
  res.json({ success: true, balance: userWallet.balance });
});

// Vending Route (Airtime & Data)
app.post('/api/vend', async (req, res) => {
  const { type, network, planOrAmount, phone, pin } = req.body;

  // 1. PIN verification
  if (pin !== userWallet.pin) {
    return res.status(400).json({ success: false, message: 'Incorrect 4-digit PIN' });
  }

  // 2. Pricing logic
  const cost = type === 'airtime' ? Number(planOrAmount) : 290; // Default test cost for 1GB

  // 3. Balance verification
  if (userWallet.balance < cost) {
    return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
  }

  // 4. Deduct balance
  userWallet.balance -= cost;

  // 5. Connect to wholesale provider API
  // In live production, replace this block with your aggregator's endpoint:
  /*
  const response = await axios.post('https://your-provider-api.com/vend', {
    api_key: process.env.VTU_API_KEY,
    network,
    phone,
    plan: planOrAmount
  });
  */

  return res.json({
    success: true,
    message: `${network.toUpperCase()} ${type.toUpperCase()} delivered to ${phone}`,
    newBalance: userWallet.balance,
    reference: 'TXN-' + Math.floor(100000 + Math.random() * 900000)
  });
});

// Fallback to serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VTU Server running on port ${PORT}`);
});
