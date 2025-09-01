import stripe, { STRIPE_PLANS } from '../config/stripe.js';
import User from '../models/User.js';

class StripeService {
  /**
   * Check if Stripe is configured
   */
  isStripeConfigured() {
    return stripe !== null;
  }

  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(userId, planId) {
    if (!this.isStripeConfigured()) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const plan = STRIPE_PLANS[planId];
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      // Create Stripe customer if doesn't exist
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: {
            userId: user._id.toString(),
            planId: planId
          }
        });
        stripeCustomerId = customer.id;
        
        // Update user with Stripe customer ID
        await User.findByIdAndUpdate(userId, {
          stripeCustomerId: stripeCustomerId
        });
      }

      // Determine price to use - prefer explicit price ID, fallback to lookup key
      let priceReference;
      if (plan.stripePriceId) {
        priceReference = { price: plan.stripePriceId };
      } else if (plan.lookupKey) {
        // Use lookup key to find price
        const prices = await stripe.prices.list({
          lookup_keys: [plan.lookupKey],
          expand: ['data.product'],
        });
        
        if (prices.data.length === 0) {
          throw new Error(`No price found with lookup key: ${plan.lookupKey}`);
        }
        
        priceReference = { price: prices.data[0].id };
      } else {
        throw new Error(`No price ID or lookup key configured for plan: ${planId}`);
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            ...priceReference,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
        metadata: {
          userId: user._id.toString(),
          planId: planId
        },
        subscription_data: {
          metadata: {
            userId: user._id.toString(),
            planId: planId
          }
        }
      });

      return session;
    } catch (error) {
      console.error('Stripe checkout session creation error:', error);
      throw error;
    }
  }

  /**
   * Verify checkout session and activate subscription
   */
  async verifyCheckoutSession(sessionId) {
    if (!this.isStripeConfigured()) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        const userId = session.metadata.userId;
        const planId = session.metadata.planId;
        const plan = STRIPE_PLANS[planId];

        // Update user subscription
        const user = await User.findByIdAndUpdate(
          userId,
          {
            'subscription.plan': planId,
            'subscription.status': 'active',
            'subscription.stripeSubscriptionId': session.subscription,
            'subscription.features': plan.features,
            'subscription.startDate': new Date(),
            'subscription.nextBillingDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
          { new: true }
        );

        return {
          success: true,
          user,
          session
        };
      }

      return {
        success: false,
        message: 'Payment not completed'
      };
    } catch (error) {
      console.error('Stripe session verification error:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(body, signature) {
    if (!this.isStripeConfigured()) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw new Error(`Webhook error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle subscription created event
   */
  async handleSubscriptionCreated(subscription) {
    try {
      const userId = subscription.metadata.userId;
      const planId = subscription.metadata.planId;
      const plan = STRIPE_PLANS[planId];

      if (!plan) {
        console.error('Invalid plan in subscription metadata:', planId);
        return;
      }

      await User.findByIdAndUpdate(userId, {
        'subscription.plan': planId,
        'subscription.status': 'active',
        'subscription.stripeSubscriptionId': subscription.id,
        'subscription.features': plan.features,
        'subscription.startDate': new Date(subscription.created * 1000),
        'subscription.nextBillingDate': new Date(subscription.current_period_end * 1000),
      });

      console.log('Subscription created for user:', userId);
    } catch (error) {
      console.error('Error handling subscription created:', error);
    }
  }

  /**
   * Handle subscription updated event
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const userId = subscription.metadata.userId;
      
      await User.findByIdAndUpdate(userId, {
        'subscription.status': subscription.status,
        'subscription.nextBillingDate': new Date(subscription.current_period_end * 1000),
      });

      console.log('Subscription updated for user:', userId);
    } catch (error) {
      console.error('Error handling subscription updated:', error);
    }
  }

  /**
   * Handle subscription deleted event
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const userId = subscription.metadata.userId;
      
      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'cancelled',
        'subscription.endDate': new Date(),
      });

      console.log('Subscription cancelled for user:', userId);
    } catch (error) {
      console.error('Error handling subscription deleted:', error);
    }
  }

  /**
   * Handle payment succeeded event
   */
  async handlePaymentSucceeded(invoice) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata.userId;
      
      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'active',
        'subscription.nextBillingDate': new Date(subscription.current_period_end * 1000),
        'subscription.lastPaymentDate': new Date(invoice.created * 1000),
      });

      console.log('Payment succeeded for user:', userId);
    } catch (error) {
      console.error('Error handling payment succeeded:', error);
    }
  }

  /**
   * Handle payment failed event
   */
  async handlePaymentFailed(invoice) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata.userId;
      
      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'past_due',
      });

      console.log('Payment failed for user:', userId);
    } catch (error) {
      console.error('Error handling payment failed:', error);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId) {
    if (!this.isStripeConfigured()) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    try {
      const user = await User.findById(userId);
      if (!user || !user.subscription.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'cancelling',
      });

      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription plans
   */
  getPlans() {
    return Object.keys(STRIPE_PLANS).map(key => ({
      id: key,
      ...STRIPE_PLANS[key]
    }));
  }
}

export default new StripeService();