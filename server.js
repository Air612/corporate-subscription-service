const express = require("express");
const path = require("path");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: "Stripeが未設定です。STRIPE_SECRET_KEYを設定してください。",
    });
  }

  try {
    const { priceId, mode } = req.body;
    if (!priceId || !mode) {
      return res.status(400).json({ error: "priceIdとmodeが必要です。" });
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin}/?checkout=success`,
      cancel_url: `${req.headers.origin}/?checkout=cancel`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/stripe-status", (req, res) => {
  res.json({
    configured: Boolean(stripe),
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    priceIds: {
      premiumSubscription: process.env.STRIPE_PRICE_PREMIUM || "",
      oneTimePurchase: process.env.STRIPE_PRICE_ONE_TIME || "",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
