import { useState } from 'react';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ShieldCheck, Lock } from 'lucide-react';
import { driverAxios } from '../services/driverApi';

const PROD_BACKEND = 'https://osi-logistics-backend.onrender.com';
const BASE_URL = import.meta.env.PROD ? `${PROD_BACKEND}/api` : '/api';

const stripePromise = fetch(`${BASE_URL}/stripe/config`)
  .then(r => r.json())
  .then(({ publishable_key }: { publishable_key: string }) => loadStripe(publishable_key))
  .catch(() => null);

interface CardFormProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function CardForm({ amount, onSuccess, onCancel }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements || !cardComplete) return;
    setProcessing(true);
    setError(null);

    try {
      const { data } = await driverAxios.post('/stripe/create-payment-intent', {
        amount,
        description: 'Comisión OSI Logistics - Driver',
      });

      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element not found');

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.client_secret,
        { payment_method: { card: cardEl } }
      );

      if (stripeError) {
        setError(stripeError.message || 'Error al procesar el pago');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      }
    } catch {
      setError('Error al conectar con el servidor. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-slate-800 rounded-2xl px-4 py-4 border border-slate-700">
        <p className="text-[11px] text-slate-400 mb-3 font-semibold uppercase tracking-wider">Datos de tarjeta</p>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#f1f5f9',
                fontFamily: 'Inter, system-ui, sans-serif',
                '::placeholder': { color: '#475569' },
              },
              invalid: { color: '#f87171' },
            },
          }}
          onChange={e => {
            setCardComplete(e.complete);
            setError(e.error?.message ?? null);
          }}
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
        <Lock className="w-3 h-3" />
        Pagos seguros con <span className="font-semibold text-[#635bff]">Stripe</span>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handlePay}
          disabled={processing || !cardComplete || !stripe}
          className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {processing ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> Pagar ${amount.toFixed(2)}</>
          )}
        </button>
      </div>
    </div>
  );
}

interface StripeCardPaymentProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripeCardPayment({ amount, onSuccess, onCancel }: StripeCardPaymentProps) {
  return (
    <Elements stripe={stripePromise}>
      <CardForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
