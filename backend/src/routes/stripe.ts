import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-06-30.basil' });
}

// Create a Stripe Checkout session to collect a commission payment
router.post('/create-checkout', authenticate, async (req: Request, res: Response) => {
  try {
    const { amount, description, billing_id, success_url, cancel_url } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: description || 'OSI Logistics Commission' },
          unit_amount: Math.round(amount * 100), // cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: success_url || 'https://app.osilogistics.com/billing?paid=1',
      cancel_url:  cancel_url  || 'https://app.osilogistics.com/billing',
      metadata: billing_id ? { billing_id: String(billing_id) } : {},
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    res.status(500).json({ error: msg });
  }
});

// Create a PaymentIntent for Stripe Elements (direct card payment, no redirect)
router.post('/create-payment-intent', authenticate, async (req: Request, res: Response) => {
  try {
    const { amount, description, billing_id } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: description || 'OSI Logistics Commission',
      metadata: billing_id ? { billing_id: String(billing_id) } : {},
    });

    res.json({ client_secret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    res.status(500).json({ error: msg });
  }
});

// Stripe webhook — mark billing settled on payment success
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    }
  } catch {
    return res.status(400).send('Webhook signature error');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const billingId = session.metadata?.billing_id;
    if (billingId) {
      const { exec } = await import('../database');
      await exec(
        "UPDATE commissions SET status='settled', settled_at=? WHERE id=?",
        [new Date().toISOString(), billingId]
      );
    }
  }

  res.json({ received: true });
});

// Get publishable key (safe to expose)
router.get('/config', (_req: Request, res: Response) => {
  res.json({ publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});

export default router;
