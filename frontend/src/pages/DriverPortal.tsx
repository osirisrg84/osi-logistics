import { useState, useEffect, useCallback } from 'react';
import {
  Package, MapPin, CheckCircle, Truck, Phone,
  Clock, Star, Navigation, LogOut, User, Activity,
  Power, Coffee, AlertTriangle, Sun, Moon, Plus, X, Home, Briefcase, Wallet, Building2, CreditCard,
  Lock, ShieldCheck, Send, Bell, BellOff, CheckCheck, Award, Edit3, Zap
} from 'lucide-react';
import osiLogo from '../assets/osi-logo.jpeg';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ordersApi, driversApi, billingApi, notificationsApi, userApi } from '../services/api';
import { Order, Driver, DriverStatus } from '../types';
import { OrderStatusBadge, PriorityBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '../services/socket';
import Map3D from '../components/Map3D';

function calcAuthority(since: string): string {
  if (!since) return '';
  const start = new Date(since);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`;
  if (months === 0) return `${years} año${years !== 1 ? 's' : ''}`;
  return `${years} año${years !== 1 ? 's' : ''}, ${months} mes${months !== 1 ? 'es' : ''}`;
}

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  assigned:  { next: 'picked_up', label: 'Confirm Pickup',    color: 'bg-blue-500 hover:bg-blue-600'   },
  picked_up: { next: 'in_transit', label: 'Start Delivery',   color: 'bg-purple-500 hover:bg-purple-600' },
  in_transit:{ next: 'delivered',  label: 'Mark Delivered ✓', color: 'bg-green-500 hover:bg-green-600'  },
};

function OrderCard({ order, onStatusUpdate }: { order: Order; onStatusUpdate: (id: string, status: string) => void }) {
  const [updating, setUpdating] = useState(false);
  const flow = STATUS_FLOW[order.status];

  const handleUpdate = async () => {
    if (!flow) return;
    setUpdating(true);
    await onStatusUpdate(order.id, flow.next);
    setUpdating(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-gray-900 dark:text-white">{order.order_number}</span>
            <PriorityBadge priority={order.priority} />
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">${(Math.round(order.price / 100) * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{(order.distance_km * 0.621371).toFixed(1)} mi</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.customer_name}</p>
        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:text-blue-700 dark:hover:text-blue-300">
          <Phone className="w-3 h-3" /> {order.customer_phone}
        </a>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Pickup</p>
            <p className="text-sm text-gray-700 dark:text-slate-300">{order.pickup_address}</p>
          </div>
        </div>
        <div className="ml-3 w-0.5 h-4 bg-gray-200 dark:bg-slate-600" />
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Delivery</p>
            <p className="text-sm text-gray-700 dark:text-slate-300">{order.delivery_address}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">Weight</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{(order.weight_kg * 2.20462).toFixed(0)} lbs</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">Created</p>
          <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">ETA</p>
          <p className="text-xs font-medium text-gray-900 dark:text-slate-100">
            {order.estimated_delivery ? format(new Date(order.estimated_delivery), 'HH:mm') : '—'}
          </p>
        </div>
      </div>

      {order.truck_type && (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
          <Truck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Equipment:</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{order.truck_type}</span>
        </div>
      )}

      {order.description && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
          <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-0.5">Commodity</p>
          <p className="text-xs text-gray-600 dark:text-slate-400">{order.description}</p>
        </div>
      )}

      {/* Dispatcher info */}
      {(order.dispatcher_name || order.dispatcher_user_id) && (
        <div className="bg-orange-50 dark:bg-orange-900/15 border border-orange-100 dark:border-orange-800/30 rounded-xl px-4 py-3">
          <p className="text-[9px] font-bold text-orange-400 dark:text-orange-500 uppercase tracking-widest mb-2">Asignado por</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
              {order.dispatcher_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'DS'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{order.dispatcher_name || 'Dispatcher'}</p>
              {order.dispatcher_code && (
                <p className="text-[11px] font-bold text-orange-500 tracking-widest mt-0.5">ID #{order.dispatcher_code}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {flow && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <button onClick={handleUpdate} disabled={updating}
          className={`w-full text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${flow.color}`}>
          {updating
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><CheckCircle className="w-4 h-4" />{flow.label}</>}
        </button>
      )}

      {order.status === 'delivered' && (
        <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Delivered {order.delivered_at ? format(new Date(order.delivered_at), 'HH:mm') : ''}</span>
        </div>
      )}
    </div>
  );
}

const EQUIP_TYPES = ['Dry Van', 'Reefer', 'Flatbed', 'Box Truck', 'Power Only', 'Hotshot', 'Tanker'];

const STATUS_CONFIG: Record<DriverStatus, { label: string; dot: string; bg: string; text: string }> = {
  available: { label: 'Online',      dot: 'bg-green-400',  bg: 'bg-green-50 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-400' },
  busy:      { label: 'On Delivery', dot: 'bg-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  on_break:  { label: 'On Break',    dot: 'bg-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  offline:   { label: 'Offline',     dot: 'bg-gray-400',   bg: 'bg-gray-100 dark:bg-slate-700',      text: 'text-gray-500 dark:text-slate-400' },
};

type Tab = 'active' | 'delivered' | 'map' | 'profile' | 'payments';

export default function DriverPortal() {
  const { user, driverProfile, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const driver = driverProfile as Driver | null;

  const [driverStatus, setDriverStatus] = useState<DriverStatus>((driver?.status as DriverStatus) ?? 'offline');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [deliveredToday, setDeliveredToday] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);

  // ── Notifications ─────────────────────────────────────────
  interface DriverNotif {
    id: string; type: string; title: string; message: string;
    read: number; created_at: string; related_id: string | null;
  }
  const [driverNotifs, setDriverNotifs] = useState<DriverNotif[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = driverNotifs.filter(n => n.read === 0).length;

  // ── Offer overlay ─────────────────────────────────────────
  const [pendingOffer, setPendingOffer] = useState<Order | null>(null);
  const [offerCountdown, setOfferCountdown] = useState(60);

  // ── Favorites ────────────────────────────────────────────
  interface Favorite { id: string; name: string; address: string; type: 'home' | 'work' | 'frequent' | 'other'; }
  const FAV_PRESETS = [
    { type: 'home'     as const, label: 'Casa',            icon: '🏠' },
    { type: 'work'     as const, label: 'Zona de trabajo', icon: '🏢' },
    { type: 'frequent' as const, label: 'Lugar frecuente', icon: '⭐' },
    { type: 'other'    as const, label: 'Otro',            icon: '📍' },
  ];
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showAddFav, setShowAddFav] = useState(false);
  const [newFav, setNewFav] = useState({ name: '', address: '', type: 'home' as Favorite['type'] });
  const [savingFav, setSavingFav] = useState(false);
  const [favError, setFavError] = useState('');

  // ── Payout method ─────────────────────────────────────────
  interface PayoutDetails { contact?: string; email?: string; username?: string; bank?: string; account?: string; routing?: string; type?: string; swift?: string; payable_to?: string; }
  const PAYOUT_OPTS = [
    { id: 'zelle',  label: 'Zelle',         icon: '📱' },
    { id: 'paypal', label: 'PayPal',         icon: '🅿️' },
    { id: 'venmo',  label: 'Venmo',          icon: '💸' },
    { id: 'ach',    label: 'Direct Deposit', icon: '🏦' },
    { id: 'check',  label: 'Check',          icon: '📝' },
  ];
  const [payoutMethod,  setPayoutMethod]  = useState('');
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails>({});
  const [editingPayout, setEditingPayout] = useState(false);
  const [savingPayout,  setSavingPayout]  = useState(false);

  // ── Equipment profile ─────────────────────────────────────
  const [truckNum, setTruckNum] = useState('');
  const [trailerNum, setTrailerNum] = useState('');
  const [localEquipType, setLocalEquipType] = useState('');
  const [editingEquip, setEditingEquip] = useState(false);
  const [savingEquip, setSavingEquip] = useState(false);

  useEffect(() => {
    if (driver) {
      setTruckNum(driver.truck_number || '');
      setTrailerNum(driver.trailer_number || '');
      setLocalEquipType(driver.equipment_type || '');
    }
  }, [driver?.id]);

  const saveEquipment = async () => {
    if (!driverId) return;
    setSavingEquip(true);
    try {
      await driversApi.update(driverId, { truck_number: truckNum, trailer_number: trailerNum, equipment_type: localEquipType });
      setEditingEquip(false);
    } catch {} finally { setSavingEquip(false); }
  };

  useEffect(() => {
    userApi.getProfile().then(({ data }) => {
      setPayoutMethod(data.payout_method || '');
      try { setPayoutDetails(data.payout_details ? JSON.parse(data.payout_details) : {}); } catch { setPayoutDetails({}); }
    }).catch(() => {});
  }, []);

  const savePayout = async () => {
    setSavingPayout(true);
    try {
      await userApi.updateProfile({ payout_method: payoutMethod, payout_details: JSON.stringify(payoutDetails) });
      setEditingPayout(false);
    } catch {} finally { setSavingPayout(false); }
  };

  const updatePayoutDetail = (k: string, v: string) => setPayoutDetails(d => ({ ...d, [k]: v }));

  const payoutSummary = (method: string, details: PayoutDetails) => {
    switch (method) {
      case 'zelle':  return details.contact || '—';
      case 'paypal': return details.email || '—';
      case 'venmo':  return details.username || '—';
      case 'ach':    return details.bank ? `${details.bank} · ****${(details.account || '').slice(-4)}` : '—';
      case 'check':  return details.payable_to ? `A nombre de: ${details.payable_to}` : '—';
      default:       return '—';
    }
  };

  // Use driver.id as the primary ID — it comes directly from the loaded driverProfile
  const driverId = driver?.id ?? user?.driver_id ?? '';

  const addFavorite = async () => {
    if (!newFav.name.trim() || !newFav.address.trim() || !driverId) return;
    setSavingFav(true);
    setFavError('');
    try {
      const { data } = await driversApi.addFavorite(driverId, newFav);
      setFavorites(prev => [...prev, data as Favorite]);
      setNewFav({ name: '', address: '', type: 'home' });
      setShowAddFav(false);
    } catch {
      setFavError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSavingFav(false);
    }
  };
  const deleteFavorite = async (id: string) => {
    if (!driverId) return;
    try {
      await driversApi.deleteFavorite(driverId, id);
      setFavorites(prev => prev.filter(f => f.id !== id));
    } catch {}
  };

  // ── Driver billing ────────────────────────────────────────
  interface DriverBillingRow {
    id: string; order_number: string; order_price: number;
    driver_charge: number; delivery_date: string | null; status: 'pending' | 'settled';
  }
  interface DriverBillingSummary { total_charged: number; settled: number; pending: number; }
  const [billingRows, setBillingRows] = useState<DriverBillingRow[]>([]);
  const [billingSummary, setBillingSummary] = useState<DriverBillingSummary | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user?.driver_id) return;
    try {
      const [assignedRes, pickedRes, transitRes, delivRes] = await Promise.all([
        ordersApi.getAll({ driver_id: user.driver_id, status: 'assigned' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'picked_up' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'in_transit' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'delivered' }),
      ]);
      setActiveOrders([...assignedRes.data.orders, ...pickedRes.data.orders, ...transitRes.data.orders]);
      setDeliveredToday(delivRes.data.orders.slice(0, 10));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.driver_id]);

  useEffect(() => {
    if (driver?.status) setDriverStatus(driver.status as DriverStatus);
  }, [driver?.status]);

  const playOfferSound = () => {
    try {
      const ctx = new AudioContext();
      [659.25, 783.99, 1046.50, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.start(start); osc.stop(start + 0.35);
      });
    } catch {}
  };

  const playAcceptSound = () => {
    try {
      const ctx = new AudioContext();
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.start(start); osc.stop(start + 0.3);
      });
    } catch {}
  };

  const playDeliveredSound = () => {
    try {
      const ctx = new AudioContext();
      [523.25, 659.25, 783.99, 1046.50, 1318.51, 1046.50, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start); osc.stop(start + 0.4);
      });
    } catch {}
  };

  useEffect(() => {
    fetchOrders();
    if (driverId) {
      driversApi.getFavorites(driverId)
        .then(r => setFavorites(r.data as Favorite[]))
        .catch(() => {});
      billingApi.getRecords({ driver_id: driverId })
        .then(r => {
          const rows = r.data as DriverBillingRow[];
          setBillingRows(rows.slice(0, 20));
          const total = rows.reduce((s, r) => s + r.driver_charge, 0);
          const settled = rows.filter(r => r.status === 'settled').reduce((s, r) => s + r.driver_charge, 0);
          setBillingSummary({ total_charged: total, settled, pending: total - settled });
        })
        .catch(() => {});
    }
    if (driverId) {
      notificationsApi.getDriverNotifs(driverId)
        .then(r => setDriverNotifs(r.data.notifications as DriverNotif[]))
        .catch(() => {});
    }

    const socket = getSocket();
    socket.emit('subscribe_orders');
    if (driverId) socket.emit('driver:subscribe', driverId);
    socket.on('order_updated', () => fetchOrders());
    socket.on('driver:notification', (notif: DriverNotif) => {
      setDriverNotifs(prev => [notif, ...prev]);
    });
    socket.on('driver:offer', (offer: Order) => {
      setPendingOffer(offer);
      setOfferCountdown(60);
      playOfferSound();
    });
    return () => {
      socket.off('order_updated');
      socket.off('driver:notification');
      socket.off('driver:offer');
    };
  }, [fetchOrders, user?.driver_id, driverId]);

  useEffect(() => {
    if (!pendingOffer) return;
    if (offerCountdown <= 0) {
      ordersApi.ignore(pendingOffer.id).catch(() => {});
      setPendingOffer(null);
      return;
    }
    const t = setTimeout(() => setOfferCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [pendingOffer, offerCountdown]);

  const playOnlineSound = () => {
    try {
      const ctx = new AudioContext();
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5 — acorde mayor ascendente
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    } catch {}
  };

  const playOfflineSound = () => {
    try {
      const ctx = new AudioContext();
      const notes = [783.99, 659.25, 523.25]; // G5 E5 C5 — acorde descendente
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.14;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {}
  };

  const setStatus = async (newStatus: DriverStatus) => {
    if (!user?.driver_id || togglingStatus) return;
    setTogglingStatus(true);
    try {
      await driversApi.update(user.driver_id, { status: newStatus });
      setDriverStatus(newStatus);
      if (newStatus === 'available') playOnlineSound();
      if (newStatus === 'offline') playOfflineSound();
    } catch {
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    await ordersApi.updateStatus(orderId, { status });
    if (status === 'delivered') playDeliveredSound();
    await fetchOrders();
  };

  // ── Payment modal ─────────────────────────────────────
  type PayTab = 'card' | 'zelle' | 'ach' | 'paypal';
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTab, setPayTab] = useState<PayTab>('card');
  const [payAmount, setPayAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [payProcessing, setPayProcessing] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const openPayModal = () => {
    setPayAmount(billingSummary ? billingSummary.pending.toFixed(2) : '');
    setPayTab('card');
    setCardNumber(''); setCardExpiry(''); setCardCvc(''); setCardName('');
    setPaySuccess(false);
    setShowPayModal(true);
  };

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePay = async () => {
    setPayProcessing(true);
    // TODO: replace with real Stripe PaymentIntent call
    await new Promise(r => setTimeout(r, 1800));
    setPayProcessing(false);
    setPaySuccess(true);
  };

  const isBusy = activeOrders.some(o => ['picked_up', 'in_transit'].includes(o.status));
  const todayRevenue = deliveredToday.reduce((sum, o) => sum + o.price, 0);
  const cfg = STATUS_CONFIG[driverStatus];

  // ── Profile completion ─────────────────────────────────────
  const profileItems = [
    { label: 'Tipo de Equipo',   done: !!localEquipType },
    { label: 'Truck #',          done: !!truckNum },
    { label: 'Trailer #',        done: !!trailerNum },
    { label: 'Método de Pago',   done: !!payoutMethod },
    { label: 'Empresa / MC#',    done: !!(driver?.company_name && driver?.mc_number) },
  ];
  const profileScore = profileItems.filter(i => i.done).length;

  // ── Achievements ───────────────────────────────────────────
  const totalDel  = driver?.total_deliveries || 0;
  const onTimeRt  = driver?.on_time_rate || 0;
  const drvRating = driver?.rating || 0;
  const ACHIEVEMENTS = [
    { icon: '🚀', label: 'Primera Milla',          desc: 'Completa tu primera entrega',         unlocked: totalDel  >= 1,   current: Math.min(totalDel, 1),    target: 1,    showProgress: false },
    { icon: '📦', label: 'Arrancando',             desc: '10 entregas completadas',             unlocked: totalDel  >= 10,  current: Math.min(totalDel, 10),   target: 10,   showProgress: true  },
    { icon: '⭐', label: 'Estrella en Ascenso',    desc: '25 entregas completadas',             unlocked: totalDel  >= 25,  current: Math.min(totalDel, 25),   target: 25,   showProgress: true  },
    { icon: '💪', label: 'Guerrero del Camino',    desc: '50 entregas completadas',             unlocked: totalDel  >= 50,  current: Math.min(totalDel, 50),   target: 50,   showProgress: true  },
    { icon: '🏆', label: 'Driver Élite',           desc: '100 entregas completadas',            unlocked: totalDel  >= 100, current: Math.min(totalDel, 100),  target: 100,  showProgress: true  },
    { icon: '⏰', label: 'Pro Puntualidad',         desc: '95%+ de entregas a tiempo',           unlocked: onTimeRt  >= 95,  current: Math.min(onTimeRt, 95),   target: 95,   showProgress: false },
    { icon: '🌟', label: 'Driver 5 Estrellas',     desc: 'Calificación de 4.8 o superior',      unlocked: drvRating >= 4.8, current: drvRating,                 target: 4.8,  showProgress: false },
    { icon: '✅', label: 'Perfil Completo',         desc: 'Todas las secciones del perfil llenas', unlocked: profileScore >= 5, current: profileScore,           target: 5,    showProgress: true  },
  ];
  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-16">

      {/* ── Header + Driver Hero — always dark/premium ──────── */}
      <div className="bg-gradient-to-b from-[#0a1628] via-[#0f1e35] to-[#132640]">

        {/* Top bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src={osiLogo} alt="OSI Logistics" className="h-8 w-auto object-contain rounded-md flex-shrink-0" />
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full tracking-wide text-blue-300 bg-blue-500/20 border border-blue-500/30">
                Driver Portal
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
              </button>
              <button onClick={() => setShowNotifs(v => !v)} className="relative p-2 rounded-xl hover:bg-white/10 transition-colors">
                <Bell className="w-4 h-4 text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={logout} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <LogOut className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Driver identity hero */}
        <div className="px-4 pt-2 pb-4">
          <div className="max-w-lg mx-auto">

            {/* Driver card */}
            <div className="flex items-center gap-4 rounded-2xl px-4 py-3.5 mb-4 bg-white/6 border border-white/10">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg ${
                  driverStatus === 'offline'   ? 'bg-slate-600/80' :
                  driverStatus === 'available' ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                  driverStatus === 'busy'      ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                                                'bg-gradient-to-br from-yellow-400 to-yellow-500'
                }`}>
                  <span className="text-white drop-shadow-sm">{user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D'}</span>
                </div>
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0f1e35] ${cfg.dot} ${driverStatus === 'available' ? 'pulse-dot' : ''}`} />
              </div>

              {/* Name & info */}
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white leading-tight truncate">{driver?.name || user?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {driver?.equipment_type || 'Driver'}
                  {driver?.plate_number && <span className="text-slate-600"> · {driver.plate_number}</span>}
                </p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-full ${
                  driverStatus === 'available' ? 'bg-green-500/20 text-green-400' :
                  driverStatus === 'busy'      ? 'bg-blue-500/20 text-blue-400' :
                  driverStatus === 'on_break'  ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-slate-700/80 text-slate-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${driverStatus === 'available' ? 'pulse-dot' : ''}`} />
                  {cfg.label}
                </span>
              </div>

              {/* Rating badge */}
              {driver?.rating && (
                <div className="flex flex-col items-center rounded-2xl px-3 py-2 flex-shrink-0 bg-amber-500/10 border border-amber-500/20">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-white mt-0.5">{driver.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Status controls */}
            {driverStatus === 'offline' ? (
              <button onClick={() => setStatus('available')} disabled={togglingStatus}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 active:scale-[0.98] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-green-500/40">
                {togglingStatus
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Power className="w-5 h-5 drop-shadow" />}
                <span className="text-base tracking-wide">Go Online</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${cfg.bg} border border-white/5`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} ${driverStatus === 'available' ? 'pulse-dot' : ''}`} />
                    <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</span>
                    {isBusy && driverStatus !== 'busy' && (
                      <span className="text-xs text-orange-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Active delivery
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${cfg.text} opacity-70`}>
                    {activeOrders.length} order{activeOrders.length !== 1 ? 's' : ''} active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {driverStatus !== 'on_break' ? (
                    <button onClick={() => setStatus('on_break')} disabled={togglingStatus || isBusy}
                      className="flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm border bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-400">
                      <Coffee className="w-4 h-4" /> Take a Break
                    </button>
                  ) : (
                    <button onClick={() => setStatus('available')} disabled={togglingStatus}
                      className="flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors text-sm border bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400">
                      <Power className="w-4 h-4" /> Resume
                    </button>
                  )}
                  <button onClick={() => setStatus('offline')} disabled={togglingStatus || isBusy}
                    className="flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm border bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400">
                    <Power className="w-4 h-4" /> Go Offline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────── */}
        <div className="px-4 pb-5">
          <div className="max-w-lg mx-auto grid grid-cols-3 gap-2">
            <div className="rounded-2xl px-2 py-3 text-center bg-white/6 border border-white/10">
              <p className="text-xl font-bold text-orange-400">{activeOrders.length}</p>
              <p className="text-[11px] mt-0.5 text-slate-500">Active Orders</p>
            </div>
            <div className="rounded-2xl px-2 py-3 text-center relative overflow-hidden"
                 style={{
                   background: 'linear-gradient(135deg, rgba(4,120,87,0.35) 0%, rgba(16,185,129,0.18) 40%, rgba(52,211,153,0.28) 70%, rgba(6,95,70,0.4) 100%)',
                   border: '1px solid rgba(52,211,153,0.45)',
                   boxShadow: '0 0 18px rgba(16,185,129,0.35), 0 0 6px rgba(52,211,153,0.25), inset 0 1px 0 rgba(167,243,208,0.2)'
                 }}>
              {/* Gem shine streak */}
              <div className="absolute top-0 left-1/4 w-1/2 h-px opacity-70"
                   style={{ background: 'linear-gradient(90deg, transparent, rgba(167,243,208,0.9), transparent)' }} />
              <div className="absolute top-1 left-[38%] w-3 h-3 rounded-full opacity-40 blur-[3px]"
                   style={{ background: 'radial-gradient(circle, #a7f3d0, transparent)' }} />
              <p className="font-black relative leading-tight"
                 style={{
                   fontSize: 'clamp(12px, 3.8vw, 18px)',
                   background: 'linear-gradient(160deg, #6ee7b7 0%, #34d399 25%, #ffffff 48%, #34d399 65%, #059669 100%)',
                   WebkitBackgroundClip: 'text',
                   WebkitTextFillColor: 'transparent',
                   backgroundClip: 'text',
                   filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.7))',
                   textShadow: 'none',
                 }}>
                ${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] mt-0.5 text-emerald-400/70">Today's Revenue</p>
            </div>
            <div className="rounded-2xl px-2 py-3 text-center bg-white/6 border border-white/10">
              <p className="text-xl font-bold text-yellow-400">★ {driver?.rating?.toFixed(1) || '—'}</p>
              <p className="text-[11px] mt-0.5 text-slate-500">My Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notification panel ─────────────────────────────── */}
      {showNotifs && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setShowNotifs(false)}>
          <div className="absolute inset-x-0 top-0 bg-black/50" style={{ height: '100%' }} />
          <div
            className="relative bg-[#0f1e35] border-b border-white/10 shadow-2xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Notificaciones</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      if (!driverId) return;
                      await notificationsApi.markDriverAllRead(driverId);
                      setDriverNotifs(prev => prev.map(n => ({ ...n, read: 1 })));
                    }}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Leer todo
                  </button>
                )}
                <button onClick={() => setShowNotifs(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Notif list */}
            <div className="overflow-y-auto flex-1">
              {driverNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <BellOff className="w-8 h-8 text-slate-600" />
                  <p className="text-sm text-slate-500">Sin notificaciones</p>
                </div>
              ) : (
                driverNotifs.map(notif => (
                  <div
                    key={notif.id}
                    onClick={async () => {
                      if (notif.read === 0) {
                        await notificationsApi.markRead(notif.id);
                        setDriverNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: 1 } : n));
                      }
                    }}
                    className={`flex items-start gap-3 px-4 py-3.5 border-b border-white/5 cursor-pointer transition-colors ${
                      notif.read === 0 ? 'bg-blue-500/8 hover:bg-blue-500/12' : 'hover:bg-white/3'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      notif.type === 'order' ? 'bg-blue-500/20' : 'bg-slate-700'
                    }`}>
                      {notif.type === 'order' ? <Package className="w-4 h-4 text-blue-400" /> : <Bell className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold truncate ${notif.read === 0 ? 'text-white' : 'text-slate-300'}`}>{notif.title}</p>
                        {notif.read === 0 && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        {(() => { try { return formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }); } catch { return ''; } })()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Content area ───────────────────────────────────── */}

      {/* Offline: 3D map fullscreen — solo cuando tab es 'active' */}
      {driverStatus === 'offline' && tab === 'active' && (
        <div className="relative" style={{ height: 'calc(100vh - 380px)', minHeight: 320 }}>
          <Map3D driver={driver} activeOrders={activeOrders} pitch={52} />
          <div className="absolute inset-x-0 top-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)' }} />
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-5 px-5 pointer-events-none">
            <div className={`backdrop-blur-xl rounded-3xl px-6 py-6 text-center shadow-2xl w-full max-w-sm pointer-events-auto ${
              dark
                ? 'bg-slate-950/90 border border-white/10'
                : 'bg-white/95 border border-gray-200 shadow-xl'
            }`}>
              {/* Icon with ring */}
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border ${
                  dark ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-white/5'
                       : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300'
                }`}>
                  <Power className={`w-8 h-8 ${dark ? 'text-slate-400' : 'text-gray-500'}`} />
                </div>
              </div>
              {/* Text */}
              <h3 className={`text-lg font-bold mb-1 tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>You're Offline</h3>
              <p className={`text-sm mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>No active deliveries at this time</p>
              <p className={`text-xs mb-5 ${dark ? 'text-slate-600' : 'text-gray-400'}`}>Go online to start receiving orders from OSI Logistics</p>
              {/* CTA */}
              <button onClick={() => setStatus('available')} disabled={togglingStatus}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 active:scale-[0.98] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-green-500/35 text-sm">
                {togglingStatus
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Power className="w-4 h-4" />}
                <span className="tracking-wide">Go Online Now</span>
              </button>
              {/* Driver name */}
              {(driver?.name || user?.name) && (
                <p className={`text-[11px] mt-3 ${dark ? 'text-slate-700' : 'text-gray-400'}`}>{driver?.name || user?.name} · OSI Logistics</p>
              )}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }} />
        </div>
      )}

      {/* Tab content — visible online siempre, y offline para delivered/map */}
      {(driverStatus !== 'offline' || tab === 'delivered' || tab === 'map') && (
        <div className="max-w-lg mx-auto px-4 py-5">

          {tab === 'active' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-gray-400 dark:text-slate-500">Loading orders...</div>
              ) : activeOrders.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">No active orders</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">New orders will appear here when assigned</p>
                </div>
              ) : (
                activeOrders.map(order => (
                  <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
                ))
              )}
            </div>
          )}

          {tab === 'delivered' && (
            <div className="space-y-3">
              {deliveredToday.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">No deliveries yet today</p>
                </div>
              ) : (
                deliveredToday.map(order => (
                  <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{order.delivery_address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">${(Math.round(order.price / 100) * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {order.delivered_at && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">{format(new Date(order.delivered_at), 'HH:mm')}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-600">Delivered</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'map' && driver && (
            <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700" style={{ height: 420 }}>
              <Map3D driver={driver} activeOrders={activeOrders} pitch={48} />
            </div>
          )}

        </div>
      )}

      {/* Profile tab — visible regardless of online status */}
      {tab === 'profile' && driver && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          {/* Driver card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 dark:text-white text-base">{driver.name}</p>
                  {driver.driver_code && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 tracking-widest border border-orange-200 dark:border-orange-700/40">
                      ID #{driver.driver_code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-500 dark:text-blue-400">{driver.email}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{driver.phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Deliveries', value: driver.total_deliveries, icon: Package },
                { label: 'On-Time Rate',     value: `${driver.on_time_rate.toFixed(0)}%`, icon: Clock },
                { label: 'License',          value: driver.license_number, icon: Truck },
                { label: 'Rating',           value: `★ ${driver.rating.toFixed(1)}`, icon: Star },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Profile Completion Banner ─────────────────────── */}
          {profileScore < profileItems.length && (
            <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200 dark:border-orange-700/40 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Completa tu Perfil</p>
                </div>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{profileScore}/{profileItems.length}</span>
              </div>
              <div className="h-2 bg-orange-100 dark:bg-orange-900/30 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
                     style={{ width: `${(profileScore / profileItems.length) * 100}%` }} />
              </div>
              <div className="space-y-1.5">
                {profileItems.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.done
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-300 dark:border-orange-700 flex-shrink-0" />}
                    <span className={`text-xs ${item.done ? 'text-gray-400 dark:text-slate-500 line-through' : 'text-gray-700 dark:text-slate-300 font-medium'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── My Equipment (editable) ───────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Equipment</h3>
              </div>
              {!editingEquip ? (
                <button onClick={() => setEditingEquip(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingEquip(false)}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveEquipment} disabled={savingEquip}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50">
                    {savingEquip && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                    Save
                  </button>
                </div>
              )}
            </div>

            {!editingEquip ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Equipment Type</span>
                  <span className={`text-sm font-semibold ${localEquipType ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {localEquipType || 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Truck #</span>
                  <span className={`text-sm font-mono font-semibold ${truckNum ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {truckNum || 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Trailer #</span>
                  <span className={`text-sm font-mono font-semibold ${trailerNum ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {trailerNum || 'Not set'}
                  </span>
                </div>
                {!truckNum && !trailerNum && (
                  <button onClick={() => setEditingEquip(true)}
                    className="w-full mt-1 py-2.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                    + Add equipment info
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">Equipment Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EQUIP_TYPES.map(t => (
                      <button key={t} onClick={() => setLocalEquipType(t)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-colors text-left ${
                          localEquipType === t
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Truck #</label>
                  <input type="text" placeholder="e.g. 9809" value={truckNum} onChange={e => setTruckNum(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Trailer #</label>
                  <input type="text" placeholder="e.g. T4126" value={trailerNum} onChange={e => setTrailerNum(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                </div>
              </div>
            )}
          </div>

          {/* Truck info */}
          {driver.plate_number && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Truck</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{driver.make} {driver.model}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{driver.plate_number}</p>
                </div>
              </div>
            </div>
          )}

          {/* Empresa / Autoridad MC */}
          {(driver.company_name || driver.mc_number) && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Company / Authority</h3>
              </div>
              <div className="space-y-2.5">
                {driver.company_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400">Company Name</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{driver.company_name}</span>
                  </div>
                )}
                {driver.mc_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400">MC# / Póliza Comercial</span>
                    <span className="text-sm font-mono font-medium text-gray-800 dark:text-slate-200">{driver.mc_number}</span>
                  </div>
                )}
                {driver.authority_since && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Tiempo con autoridad</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">{calcAuthority(driver.authority_since)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagos shortcut */}
          <button
            onClick={() => setTab('payments')}
            className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <Wallet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Mis Pagos a OSI</p>
                {billingSummary && billingSummary.pending > 0 ? (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    ${billingSummary.pending.toFixed(2)} pendiente
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Ver historial de pagos</p>
                )}
              </div>
            </div>
            <span className="text-gray-300 dark:text-slate-600 text-lg">›</span>
          </button>

          {/* Lugares favoritos */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lugares favoritos</h3>
              </div>
              {favorites.length < 5 && !showAddFav && (
                <button onClick={() => setShowAddFav(true)}
                  className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              )}
            </div>

            {favorites.length === 0 && !showAddFav && (
              <div className="text-center py-4">
                <MapPin className="w-8 h-8 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-slate-500">No hay lugares guardados</p>
                <button onClick={() => setShowAddFav(true)}
                  className="mt-2 text-xs text-orange-500 hover:text-orange-600 font-medium">
                  + Agregar un lugar
                </button>
              </div>
            )}

            {favorites.length > 0 && (
              <div className="space-y-2 mb-3">
                {favorites.map(fav => {
                  const preset = FAV_PRESETS.find(p => p.type === fav.type);
                  return (
                    <div key={fav.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-xl px-3 py-2.5">
                      <span className="text-lg flex-shrink-0">{preset?.icon || '📍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{fav.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{fav.address}</p>
                      </div>
                      <button onClick={() => deleteFavorite(fav.id)}
                        className="text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add form */}
            {showAddFav && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Nuevo lugar</p>
                {/* Type selector */}
                <div className="grid grid-cols-4 gap-1.5">
                  {FAV_PRESETS.map(p => (
                    <button key={p.type} onClick={() => setNewFav(f => ({ ...f, type: p.type }))}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-center transition-colors ${
                        newFav.type === p.type
                          ? 'bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-400'
                          : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}>
                      <span className="text-base">{p.icon}</span>
                      <span className="text-[9px] text-gray-600 dark:text-slate-400 leading-tight">{p.label}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Nombre del lugar"
                  value={newFav.name}
                  onChange={e => setNewFav(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
                <input
                  type="text"
                  placeholder="Dirección"
                  value={newFav.address}
                  onChange={e => setNewFav(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
                {favError && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{favError}</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddFav(false); setFavError(''); setNewFav({ name: '', address: '', type: 'home' }); }}
                    className="flex-1 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={addFavorite} disabled={!newFav.name.trim() || !newFav.address.trim() || savingFav}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                    {savingFav
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Plus className="w-4 h-4" /> Guardar</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Achievements / Logros ─────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-50 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Logros</h3>
                </div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  {unlockedCount} / {ACHIEVEMENTS.length}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">Sigue entregando para desbloquear más logros</p>
              {/* Overall progress */}
              <div className="mt-3 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all"
                     style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }} />
              </div>
            </div>

            {/* Achievement list */}
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {ACHIEVEMENTS.map(a => (
                <div key={a.label} className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                  a.unlocked ? '' : 'opacity-50'
                }`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl shadow-sm ${
                    a.unlocked
                      ? 'bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20'
                      : 'bg-gray-100 dark:bg-slate-700 grayscale'
                  }`}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={`text-sm font-semibold ${a.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>
                        {a.label}
                      </p>
                      {a.unlocked ? (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide">
                          Unlocked
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{a.desc}</p>
                    {a.showProgress && !a.unlocked && a.current !== undefined && a.target !== undefined && (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-600 mb-1">
                          <span>{a.current} / {a.target}</span>
                          <span className="text-orange-500 font-semibold">{Math.round((a.current / a.target) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300 rounded-full transition-all"
                               style={{ width: `${Math.min((a.current / a.target) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments tab — always accessible */}
      {tab === 'payments' && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          {/* Balance card */}
          {billingSummary && (
            <div className={`rounded-2xl p-5 ${
              dark
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300'
            }`}>
              <p className={`text-base font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Balance pendiente</p>
              <p className={`text-3xl font-bold ${dark ? 'text-yellow-400' : 'text-orange-500'}`}>${billingSummary.pending.toFixed(2)}</p>
              <p className={`text-xs mt-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Por cada carga entregada, OSI toma solo el <span className={`font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>8%</span>.</p>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={dark ? 'text-slate-400' : 'text-slate-500'}>Progreso de pago</span>
                  <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>
                    {billingSummary.total_charged > 0 ? Math.round((billingSummary.settled / billingSummary.total_charged) * 100) : 0}%
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-slate-700' : 'bg-slate-300'}`}>
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${billingSummary.total_charged > 0 ? (billingSummary.settled / billingSummary.total_charged) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] pt-0.5">
                  <span className={dark ? 'text-slate-500' : 'text-slate-400'}>Pagado: <span className="text-green-500 font-semibold">${billingSummary.settled.toFixed(2)}</span></span>
                  <span className={dark ? 'text-slate-500' : 'text-slate-400'}>Total: <span className={`font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>${billingSummary.total_charged.toFixed(2)}</span></span>
                </div>
              </div>
              {billingSummary.pending > 0 && (
                <button
                  onClick={openPayModal}
                  className="mt-4 w-full bg-green-500 hover:bg-green-400 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                >
                  <CreditCard className="w-4 h-4" /> Realizar Pago
                </button>
              )}
              {billingSummary.pending === 0 && billingSummary.total_charged > 0 && (
                <div className="mt-4 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl py-2.5">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Al día con OSI ✓</span>
                </div>
              )}
            </div>
          )}

          {/* Records */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-1 mb-2">Historial de cobros</p>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              {billingRows.length === 0 ? (
                <div className="py-10 text-center">
                  <Wallet className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">Todo al día 👍</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Aquí aparecerán los cobros cuando entregues cargas</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {billingRows.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === 'settled' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.order_number}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                            ${r.order_price.toFixed(2)} carga · 8% = <span className="font-semibold text-gray-600 dark:text-slate-300">${r.driver_charge.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        r.status === 'settled'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        {r.status === 'settled' ? '✓ Pagado' : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ──────────────────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

            {paySuccess ? (
              /* ── Success state ── */
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">¡Pago enviado!</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-green-600">${parseFloat(payAmount || '0').toFixed(2)}</span> procesado correctamente
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-6">OSI Logistics recibirá la confirmación en breve.</p>
                <button
                  onClick={() => setShowPayModal(false)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Realizar Pago a OSI</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Selecciona método y monto</p>
                  </div>
                  <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Amount input */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Monto a pagar</label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="w-full pl-7 pr-4 py-2.5 text-lg font-bold rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400/40"
                      />
                    </div>
                    {billingSummary && parseFloat(payAmount) > 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 px-1">
                        Balance pendiente: <span className="font-semibold text-yellow-500">${billingSummary.pending.toFixed(2)}</span>
                      </p>
                    )}
                  </div>

                  {/* Method tabs */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Método de pago</label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {([
                        { id: 'card',   label: '💳 Tarjeta' },
                        { id: 'zelle',  label: '📱 Zelle' },
                        { id: 'ach',    label: '🏦 ACH' },
                        { id: 'paypal', label: null },
                      ] as { id: PayTab; label: string | null }[]).map(m => (
                        <button
                          key={m.id}
                          onClick={() => setPayTab(m.id)}
                          className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                            payTab === m.id
                              ? 'bg-slate-900 dark:bg-slate-700 text-white'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {m.id === 'paypal' ? (
                            <span className="flex items-center justify-center gap-0.5 leading-none">
                              <span style={{ color: payTab === 'paypal' ? '#7EC8E3' : '#003087', fontWeight: 900, fontSize: 11 }}>Pay</span>
                              <span style={{ color: payTab === 'paypal' ? '#b3d9f0' : '#009CDE', fontWeight: 900, fontSize: 11 }}>Pal</span>
                            </span>
                          ) : m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card form */}
                  {payTab === 'card' && (
                    <div className="space-y-3">
                      <div>
                        <label className="label text-xs">Número de tarjeta</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                          className="input font-mono tracking-widest"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Vencimiento</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="MM/AA"
                            value={cardExpiry}
                            onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                            className="input font-mono"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">CVV</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="123"
                            maxLength={4}
                            value={cardCvc}
                            onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            className="input font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs">Nombre en la tarjeta</label>
                        <input
                          type="text"
                          placeholder="CARLOS RODRIGUEZ"
                          value={cardName}
                          onChange={e => setCardName(e.target.value.toUpperCase())}
                          className="input uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {/* Zelle */}
                  {payTab === 'zelle' && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/40 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                        <Send className="w-4 h-4" /> Enviar por Zelle
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Envía el monto exacto a:</p>
                      <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Email</span>
                          <span className="font-semibold text-gray-900 dark:text-white">pagos@osilogistics.com</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Teléfono</span>
                          <span className="font-semibold text-gray-900 dark:text-white">+1 (305) 000-0000</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">A nombre de</span>
                          <span className="font-semibold text-gray-900 dark:text-white">OSI Logistics Inc.</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-purple-500 dark:text-purple-400">Incluye tu nombre completo en el memo del Zelle.</p>
                    </div>
                  )}

                  {/* ACH */}
                  {payTab === 'ach' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        🏦 Transferencia ACH / Wire
                      </p>
                      <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Banco</span>
                          <span className="font-semibold text-gray-900 dark:text-white">Bank of America</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Routing #</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">026009593</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Account #</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">••••••4821</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Beneficiario</span>
                          <span className="font-semibold text-gray-900 dark:text-white">OSI Logistics Inc.</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-blue-500 dark:text-blue-400">Incluye tu nombre y Driver ID en el memo.</p>
                    </div>
                  )}

                  {/* PayPal */}
                  {payTab === 'paypal' && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">PayPal</p>
                      <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">PayPal.me</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">@OSILogistics</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Email</span>
                          <span className="font-semibold text-gray-900 dark:text-white">pagos@osilogistics.com</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-indigo-500 dark:text-indigo-400">Envía como "Familia y amigos" para evitar comisiones.</p>
                    </div>
                  )}

                  {/* Stripe security badge */}
                  {payTab === 'card' && (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
                      <Lock className="w-3 h-3" />
                      Pagos seguros con <span className="font-semibold text-[#635bff]">Stripe</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowPayModal(false)}
                      className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    {payTab === 'card' ? (
                      <button
                        onClick={handlePay}
                        disabled={payProcessing || !payAmount || parseFloat(payAmount) <= 0 || !cardNumber || !cardExpiry || !cardCvc || !cardName}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                      >
                        {payProcessing
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
                          : <><ShieldCheck className="w-4 h-4" /> Pagar ${parseFloat(payAmount || '0').toFixed(2)}</>
                        }
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowPayModal(false)}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Entendido
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed Bottom Navigation ─────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-700 flex items-stretch">
        {([
          { id: 'active',    icon: Activity,    label: 'Active',  badge: activeOrders.length },
          { id: 'delivered', icon: CheckCircle, label: 'Done',    badge: deliveredToday.length },
          { id: 'map',       icon: Navigation,  label: 'Map',     badge: 0 },
          { id: 'payments',  icon: Wallet,      label: 'Pagos',   badge: (billingSummary?.pending ?? 0) > 0 ? 1 : 0 },
          { id: 'profile',   icon: User,        label: 'Perfil',  badge: 0 },
        ] as const).map(({ id, icon: Icon, label, badge }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative ${
                isActive ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-orange-500 rounded-full" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Offer overlay ──────────────────────────────────── */}
      {pendingOffer && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 pb-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest">¡Nueva Oferta!</p>
                <p className="text-white font-bold text-xl">{pendingOffer.order_number}</p>
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-colors ${
                offerCountdown <= 10 ? 'border-red-300 bg-red-500/40' : 'border-white/40 bg-white/20'
              }`}>
                <span className={`font-bold text-2xl ${offerCountdown <= 10 ? 'text-red-100' : 'text-white'}`}>
                  {offerCountdown}
                </span>
              </div>
            </div>
            {/* Timer bar */}
            <div className="h-1.5 bg-gray-100 dark:bg-slate-700">
              <div
                className={`h-full transition-all duration-1000 ${offerCountdown <= 10 ? 'bg-red-500' : 'bg-orange-400'}`}
                style={{ width: `${(offerCountdown / 60) * 100}%` }}
              />
            </div>

            <div className="p-5 space-y-3">
              {/* Price + Distance */}
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">${(Math.round(pendingOffer.price / 100) * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{(pendingOffer.distance_km * 0.621371).toFixed(1)} mi</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{(pendingOffer.weight_kg * 2.20462).toFixed(0)} lbs</p>
                </div>
              </div>

              {/* Pickup */}
              <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
                <div className="w-6 h-6 bg-orange-100 dark:bg-orange-800/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">Pickup</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 leading-snug">{pendingOffer.pickup_address}</p>
                </div>
              </div>

              {/* Delivery */}
              <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Delivery</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 leading-snug">{pendingOffer.delivery_address}</p>
                </div>
              </div>

              {/* Customer + description */}
              <div className="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-slate-400">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{pendingOffer.customer_name}</span>
                {pendingOffer.description && (
                  <>
                    <span className="text-gray-300 dark:text-slate-600">·</span>
                    <Package className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{pendingOffer.description}</span>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={async () => {
                    await ordersApi.ignore(pendingOffer.id).catch(() => {});
                    setPendingOffer(null);
                    fetchOrders();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Ignorar
                </button>
                <button
                  onClick={async () => {
                    playAcceptSound();
                    await ordersApi.accept(pendingOffer.id).catch(() => {});
                    setPendingOffer(null);
                    fetchOrders();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 active:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                >
                  <CheckCircle className="w-4 h-4" /> Aceptar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
