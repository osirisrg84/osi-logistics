import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, MapPin, CheckCircle, Truck, Phone,
  Clock, Star, Navigation, LogOut, User, Activity,
  Power, Coffee, AlertTriangle, Sun, Moon, Plus, X, Home, Briefcase, Wallet, Building2, CreditCard,
  Lock, ShieldCheck, Send, Bell, BellOff, CheckCheck, Award, Edit3, Zap,
  Headphones, Radio, Users, PhoneCall, MessageSquare, Heart,
  FileText, Upload, Calendar, AlertCircle, Mail
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

const EQUIP_TYPES     = ['Dry Van', 'Reefer', 'Power Only', 'Flatbed', 'Tanker', 'Van', 'Box Truck', 'Hotshot'];
const EQUIP_WITH_DIMS = ['Van', 'Box Truck', 'Hotshot'];

const STATUS_CONFIG: Record<DriverStatus, { label: string; dot: string; bg: string; text: string }> = {
  available: { label: 'Online',      dot: 'bg-green-400',  bg: 'bg-green-50 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-400' },
  busy:      { label: 'On Delivery', dot: 'bg-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  on_break:  { label: 'On Break',    dot: 'bg-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  offline:   { label: 'Offline',     dot: 'bg-gray-400',   bg: 'bg-gray-100 dark:bg-slate-700',      text: 'text-gray-500 dark:text-slate-400' },
};

type Tab = 'active' | 'delivered' | 'map' | 'profile' | 'payments' | 'hub';

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

  // ── Verification ──────────────────────────────────────────────
  const [emailVerified,      setEmailVerified]      = useState(false);
  const [phoneVerified,      setPhoneVerified]      = useState(false);
  const [verifying,          setVerifying]          = useState<'email' | 'phone' | null>(null);
  const [codeInput,          setCodeInput]          = useState('');
  const [codeSent,           setCodeSent]           = useState(false);
  const [sendingCode,        setSendingCode]        = useState(false);
  const [verifyingCode,      setVerifyingCode]      = useState(false);
  const [verifyMsg,          setVerifyMsg]          = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  const handleSendCode = async (type: 'email' | 'phone') => {
    setSendingCode(true); setVerifyMsg('');
    try {
      await userApi.sendVerification(type);
      setCodeSent(true);
      setVerifyMsg(type === 'phone' ? 'Código enviado — revisa tus SMS' : 'Código enviado — revisa tu correo');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error || (e as { message?: string })?.message || 'Error al enviar el código';
      setVerifyMsg(msg);
    } finally { setSendingCode(false); }
  };

  const handleVerifyCode = async () => {
    if (!verifying) return;
    setVerifyingCode(true); setVerifyMsg('');
    try {
      await userApi.verifyCode(verifying, codeInput);
      if (verifying === 'email') setEmailVerified(true);
      else setPhoneVerified(true);
      setVerifying(null); setCodeInput(''); setCodeSent(false);
    } catch { setVerifyMsg('Código incorrecto o expirado'); }
    finally { setVerifyingCode(false); }
  };

  const cancelVerify = () => {
    setVerifying(null); setCodeInput(''); setCodeSent(false); setVerifyMsg('');
  };

  // ── Equipment profile ─────────────────────────────────────
  const [truckNum, setTruckNum] = useState('');
  const [trailerNum, setTrailerNum] = useState('');
  const [localEquipType, setLocalEquipType] = useState('');
  const [localTruckMake, setLocalTruckMake] = useState('');
  const [equipLength, setEquipLength] = useState('');
  const [equipWidth, setEquipWidth] = useState('');
  const [loadCapacity, setLoadCapacity] = useState('');
  const [editingEquip, setEditingEquip] = useState(false);
  const [savingEquip, setSavingEquip] = useState(false);

  // ── Hub: switches / radio / community ────────────────────
  const [trackingOn, setTrackingOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  interface RadioMsg { id:string; name:string; msg:string; ts:string; type?:'text'|'voice'; audioData?:string; duration?:number; }
  const [radioMsgs, setRadioMsgs] = useState<RadioMsg[]>([
    { id:'r1', name:'Carlos M.', msg:'Buenos días familia OSI! Arrancando ruta norte 🛣️', ts: new Date(Date.now()-1800000).toISOString(), type:'text' },
    { id:'r2', name:'James W.', msg:'Clear roads on I-95 heading north 👌 Good weather', ts: new Date(Date.now()-900000).toISOString(), type:'text' },
    { id:'r3', name:'Ana R.', msg:'Entregando en Doral, todo perfecto 💪 #OSIFleet', ts: new Date(Date.now()-300000).toISOString(), type:'text' },
  ]);
  const [radioInput, setRadioInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const radioScrollRef = { current: null as HTMLDivElement | null };
  const [communityPosts, setCommunityPosts] = useState([
    { id:'cp1', avatar:'CM', name:'Carlos Mendez', time:'2h', msg:'Acabo de completar mi entrega #100 con OSI! 🎉 Gracias a todo el equipo dispatch. #OSILogistics', likes:7, liked:false },
    { id:'cp2', avatar:'JW', name:'James Wilson', time:'4h', msg:'Best dispatch team in South Florida! Running smooth today 🚛💨', likes:4, liked:false },
    { id:'cp3', avatar:'AR', name:'Ana Rodriguez', time:'5h', msg:'Tip pro: chequea siempre el dock antes de llegar. Ahorras tiempo y mueves más cargas 💡', likes:12, liked:false },
  ]);
  const [postText, setPostText] = useState('');
  const [hubSection, setHubSection] = useState<'community'|'support'|'radio'>('community');

  useEffect(() => {
    if (driver) {
      setTruckNum(driver.truck_number || '');
      setTrailerNum(driver.trailer_number || '');
      setLocalEquipType(driver.equipment_type || '');
      setLocalTruckMake(driver.truck_make || '');
      const d = driver as unknown as Record<string, string>;
      setEquipLength(d.equip_length || '');
      setEquipWidth(d.equip_width || '');
      setLoadCapacity(d.load_capacity || '');
      setCoiFileName(d.coi_filename || '');
      setCoiExpiry(d.coi_expiry || '');
      setFactoringCompany(d.factoring_company || '');
      setFactoringPhone(d.factoring_phone || '');
      setFactoringEmail(d.factoring_email || '');
      setFactoringNoa(d.factoring_noa === '1' || d.factoring_noa === 'true');
    }
  }, [driver?.id]);

  const saveEquipment = async () => {
    if (!driverId) return;
    setSavingEquip(true);
    try {
      const dimFields = EQUIP_WITH_DIMS.includes(localEquipType)
        ? { equip_length: equipLength, equip_width: equipWidth, load_capacity: loadCapacity }
        : { equip_length: '', equip_width: '', load_capacity: '' };
      await driversApi.update(driverId, { truck_number: truckNum, trailer_number: trailerNum, equipment_type: localEquipType, truck_make: localTruckMake, ...dimFields });
      setEditingEquip(false);
    } catch {} finally { setSavingEquip(false); }
  };

  useEffect(() => {
    userApi.getProfile().then(({ data }) => {
      setPayoutMethod(data.payout_method || '');
      try { setPayoutDetails(data.payout_details ? JSON.parse(data.payout_details) : {}); } catch { setPayoutDetails({}); }
      setEmailVerified(!!data.email_verified);
      setPhoneVerified(!!data.phone_verified);
      setProfilePhone(data.phone || '');
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

  // COI — Certificate of Insurance
  const [coiFileName, setCoiFileName] = useState('');
  const [coiExpiry, setCoiExpiry] = useState('');
  const [coiEditing, setCoiEditing] = useState(false);

  // Factoring
  const [factoringCompany, setFactoringCompany] = useState('');
  const [factoringPhone,   setFactoringPhone]   = useState('');
  const [factoringEmail,   setFactoringEmail]   = useState('');
  const [factoringNoa,     setFactoringNoa]     = useState(false); // NOA active?
  const [editingFactoring, setEditingFactoring] = useState(false);
  const [savingFactoring,  setSavingFactoring]  = useState(false);

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
      // Alarma potente: patrón urgente de 3 pulsos dobles
      const pattern = [880, 1174.66, 880, 1174.66, 880, 1174.66, 1318.51, 1568];
      pattern.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.6, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.start(start); osc.stop(start + 0.3);
      });
    } catch {}
    navigator.vibrate?.([400, 150, 400, 150, 600, 300, 400, 150, 400]);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    navigator.vibrate?.(0);
  };

  const startAlarm = () => {
    stopAlarm();
    playOfferSound();
    alarmIntervalRef.current = setInterval(() => {
      playOfferSound();
    }, 8000);
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
        gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
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
      setOfferCountdown(7200);
      startAlarm();
      // Browser push notification
      if ('Notification' in window) {
        const show = () => new Notification('🚛 Nueva oferta de carga', {
          body: `Orden ${offer.order_number} · ${offer.pickup_address} → ${offer.delivery_address}`,
          icon: '/favicon.ico',
          requireInteraction: true,
        });
        if (Notification.permission === 'granted') show();
        else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') show(); });
      }
    });
    socket.emit('radio:join');
    socket.on('radio:msg', (data: {name:string; msg:string; ts:string}) => {
      setRadioMsgs(prev => [...prev.slice(-49), { id: Date.now().toString(), type: 'text' as const, ...data }]);
    });
    socket.on('radio:voice', (data: {name:string; audioData:string; duration:number; ts:string}) => {
      setRadioMsgs(prev => [...prev.slice(-49), { id: Date.now().toString(), type: 'voice' as const, msg: '', ...data }]);
    });
    return () => {
      socket.off('order_updated');
      socket.off('driver:notification');
      socket.off('driver:offer');
      socket.off('radio:msg');
      socket.off('radio:voice');
    };
  }, [fetchOrders, user?.driver_id, driverId]);

  useEffect(() => {
    if (!pendingOffer) return;
    if (offerCountdown <= 0) {
      stopAlarm();
      ordersApi.ignore(pendingOffer.id).catch(() => {});
      setPendingOffer(null);
      return;
    }
    const t = setTimeout(() => setOfferCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [pendingOffer, offerCountdown]);

  useEffect(() => {
    if (!isRecording) { setRecordingDuration(0); return; }
    const t = setInterval(() => setRecordingDuration(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  const playOnlineSound = () => {
    try {
      const audio = new Audio('/sounds/truck-engine-6s-fadeout.mp3');
      audio.volume = 0.25;
      audio.play().catch(() => {});
    } catch {}
    navigator.vibrate?.([300, 100, 200, 100, 400]);
  };

  const playBreakSound = () => {
    try {
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      // Tono suave descendente — C5 → A4 → F4 (relajante)
      [523.25, 440, 349.23].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(ctx.destination);
        const s = t + i * 0.18;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.15, s + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.45);
        osc.start(s); osc.stop(s + 0.45);
      });
    } catch {}
  };

  const playRetakeSound = () => {
    try {
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      // Tono ascendente energético — F4 → A4 → C5 → E5 (volviendo a la acción)
      [349.23, 440, 523.25, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(ctx.destination);
        const s = t + i * 0.11;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.16, s + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.3);
        osc.start(s); osc.stop(s + 0.3);
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
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {}
  };

  const gpsWatchRef      = useRef<number | null>(null);
  const lastAddrRef      = useRef<{ lat: number; lng: number; address: string } | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [gpsUpdating, setGpsUpdating] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    const prev = lastAddrRef.current;
    // skip API call if we haven't moved more than ~500 m AND we have a valid cached address
    if (prev?.address && Math.abs(lat - prev.lat) < 0.005 && Math.abs(lng - prev.lng) < 0.005) {
      return prev.address;
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en-US,en' } }
      );
      const d = await r.json();
      const city  = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
      const state = (d.address?.['ISO3166-2-lvl4'] as string | undefined)?.split('-')[1]
                 || (d.address?.state as string | undefined)?.slice(0, 2).toUpperCase()
                 || '';
      const address = city ? `${city}, ${state}` : '';
      if (address) lastAddrRef.current = { lat, lng, address }; // only cache successful results
      return address;
    } catch {
      return lastAddrRef.current?.address ?? '';
    }
  }, []);

  const shareLocation = useCallback(async () => {
    if (!user?.driver_id || !navigator.geolocation) return;
    setGpsUpdating(true);
    lastAddrRef.current = null; // force fresh Nominatim call
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          await driversApi.updateLocation(user.driver_id!, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed ?? 0,
            address,
          });
        } catch { /* non-critical */ }
        setGpsUpdating(false);
      },
      () => setGpsUpdating(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [user?.driver_id, reverseGeocode]);

  useEffect(() => {
    if (!user?.driver_id || !navigator.geolocation) return;
    if (trackingOn) {
      // Appear on the map when GPS turns on
      driversApi.update(user.driver_id, { gps_active: 1 }).catch(() => {});
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            await driversApi.updateLocation(user.driver_id!, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed ?? 0,
              address,
            });
          } catch { /* non-critical */ }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    } else {
      // Disappear from map when GPS turns off
      driversApi.update(user.driver_id, { gps_active: 0 }).catch(() => {});
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    }
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [trackingOn, user?.driver_id, reverseGeocode]);

  const setStatus = async (newStatus: DriverStatus) => {
    if (!user?.driver_id || togglingStatus) return;
    setTogglingStatus(true);
    try {
      await driversApi.update(user.driver_id, { status: newStatus });
      setDriverStatus(newStatus);
      if (newStatus === 'available' && driverStatus === 'offline') playOnlineSound();
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

  // ── Company / Authority helpers ────────────────────────────
  const currentEquipType = localEquipType || (driver?.equipment_type ?? '');
  const isDotEquip = EQUIP_WITH_DIMS.includes(currentEquipType);
  const driverExtra = driver as unknown as Record<string, string>;
  const stripPrefix = (v: string) => v.replace(/^(MC-|DOT-)/i, '');
  const authorityNum = isDotEquip
    ? stripPrefix(driverExtra?.dot_number || driver?.mc_number || '')
    : stripPrefix(driver?.mc_number || '');

  // ── Profile completion ─────────────────────────────────────
  const profileItems = [
    { label: 'Truck Make',       done: !!localTruckMake },
    { label: 'Tipo de Equipo',   done: !!localEquipType },
    ...(!isDotEquip ? [
      { label: 'Truck #',        done: !!truckNum },
      { label: 'Trailer #',      done: !!trailerNum },
    ] : []),
    ...(isDotEquip ? [
      { label: 'Dimensiones (pies)',        done: !!(equipLength && equipWidth) },
      { label: 'Capacidad de carga (lbs)',  done: !!loadCapacity },
    ] : []),
    { label: 'Método de Pago',   done: !!payoutMethod },
    { label: isDotEquip ? 'Company / DOT#' : 'Company / MC#',
      done: !!(driver?.company_name && authorityNum) },
    { label: 'COI / Seguro',     done: !!coiFileName },
    { label: 'Factoring',        done: !!factoringCompany },
  ];
  const profileScore = profileItems.filter(i => i.done).length;

  // ── Achievements ───────────────────────────────────────────
  const totalDel  = driver?.total_deliveries || 0;
  const onTimeRt  = driver?.on_time_rate || 0;
  const drvRating = driver?.rating || 0;
  const ACHIEVEMENTS = [
    { icon: '✅', label: 'Perfil Completo',         desc: 'Todas las secciones del perfil llenas', unlocked: profileScore >= 8, current: profileScore,           target: 8,    showProgress: true  },
    { icon: '🚀', label: 'Primera Milla',          desc: 'Completa tu primera entrega',         unlocked: totalDel  >= 1,   current: Math.min(totalDel, 1),    target: 1,    showProgress: false },
    { icon: '📦', label: 'Arrancando',             desc: '10 entregas completadas',             unlocked: totalDel  >= 10,  current: Math.min(totalDel, 10),   target: 10,   showProgress: true  },
    { icon: '⭐', label: 'Estrella en Ascenso',    desc: '25 entregas completadas',             unlocked: totalDel  >= 25,  current: Math.min(totalDel, 25),   target: 25,   showProgress: true  },
    { icon: '💪', label: 'Guerrero del Camino',    desc: '50 entregas completadas',             unlocked: totalDel  >= 50,  current: Math.min(totalDel, 50),   target: 50,   showProgress: true  },
    { icon: '🏆', label: 'Driver Élite',           desc: '100 entregas completadas',            unlocked: totalDel  >= 100, current: Math.min(totalDel, 100),  target: 100,  showProgress: true  },
    { icon: '⏰', label: 'Pro Puntualidad',         desc: '95%+ de entregas a tiempo',           unlocked: onTimeRt  >= 95,  current: Math.min(onTimeRt, 95),   target: 95,   showProgress: false },
    { icon: '🌟', label: 'Driver 5 Estrellas',     desc: 'Calificación de 4.8 o superior',      unlocked: drvRating >= 4.8, current: drvRating,                 target: 4.8,  showProgress: false },
  ];
  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;

  return (
    <div className={`min-h-screen pb-16 ${driverStatus === 'offline' && tab === 'active' ? 'bg-[#0a1628]' : 'bg-gray-50 dark:bg-slate-900'}`}>

      {/* ── Header + Driver Hero — always dark/premium ──────── */}
      <div className="bg-gradient-to-b from-[#0a1628] via-[#0f1e35] to-[#132640] sticky top-0 z-40" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>

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

            {/* ── Compact 3-Switch Row ──────────────────────── */}
            <div className="space-y-2 mb-4">
              <div className="flex gap-1.5">

                {/* Switch 1 — Go Online */}
                <button
                  onClick={() => { if (togglingStatus) return; setStatus(driverStatus === 'offline' ? 'available' : 'offline'); }}
                  className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all min-w-0"
                  style={{
                    background: driverStatus !== 'offline' ? 'rgba(34,197,94,0.13)' : 'rgba(15,30,53,0.9)',
                    border: `1px solid ${driverStatus !== 'offline' ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: driverStatus !== 'offline' ? '0 0 8px rgba(34,197,94,0.15)' : 'none',
                  }}>
                  <Power className={`w-3 h-3 flex-shrink-0 transition-colors ${driverStatus !== 'offline' ? 'text-green-400' : 'text-slate-600'}`} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[9px] font-bold text-white leading-none">Go Online</p>
                    <p className="text-[8px] leading-none mt-0.5" style={{ color: driverStatus !== 'offline' ? '#4ade80' : '#475569' }}>
                      {driverStatus === 'offline' ? 'Offline' : driverStatus === 'on_break' ? 'Break' : 'Online'}
                    </p>
                  </div>
                  {togglingStatus
                    ? <div className="w-3 h-3 border-2 border-white/20 border-t-green-400 rounded-full animate-spin flex-shrink-0" />
                    : <div className="relative flex-shrink-0 rounded-full" style={{ width: 24, height: 13, background: driverStatus !== 'offline' ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'rgba(51,65,85,0.9)', boxShadow: driverStatus !== 'offline' ? '0 0 6px rgba(34,197,94,0.4)' : 'none', transition: 'background 0.25s' }}>
                        <div className="absolute rounded-full bg-white" style={{ width: 9, height: 9, top: 2, left: driverStatus !== 'offline' ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </div>
                  }
                </button>

                {/* Switch 2 — GPS */}
                <button
                  onClick={() => setTrackingOn(v => !v)}
                  className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all min-w-0"
                  style={{
                    background: trackingOn ? 'rgba(6,182,212,0.13)' : 'rgba(15,30,53,0.9)',
                    border: `1px solid ${trackingOn ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: trackingOn ? '0 0 8px rgba(6,182,212,0.15)' : 'none',
                  }}>
                  <Navigation className={`w-3 h-3 flex-shrink-0 transition-colors ${trackingOn ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[9px] font-bold text-white leading-none">GPS</p>
                    <p className="text-[8px] leading-none mt-0.5" style={{ color: trackingOn ? '#22d3ee' : '#475569' }}>
                      {trackingOn ? 'Live' : 'Paused'}
                    </p>
                  </div>
                  <div className="relative flex-shrink-0 rounded-full" style={{ width: 24, height: 13, background: trackingOn ? 'linear-gradient(90deg,#06b6d4,#0891b2)' : 'rgba(51,65,85,0.9)', boxShadow: trackingOn ? '0 0 6px rgba(6,182,212,0.4)' : 'none', transition: 'background 0.25s' }}>
                    <div className="absolute rounded-full bg-white" style={{ width: 9, height: 9, top: 2, left: trackingOn ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </div>
                </button>

                {/* Switch 3 — Music */}
                <button
                  onClick={() => setMusicOn(v => !v)}
                  className="flex-1 flex items-center gap-1 px-1.5 py-2.5 rounded-xl select-none active:scale-[0.97] transition-all min-w-0"
                  style={{
                    background: musicOn ? 'rgba(168,85,247,0.13)' : 'rgba(15,30,53,0.9)',
                    border: `1px solid ${musicOn ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: musicOn ? '0 0 8px rgba(168,85,247,0.15)' : 'none',
                  }}>
                  <Headphones className={`w-3 h-3 flex-shrink-0 transition-colors ${musicOn ? 'text-purple-400' : 'text-slate-600'}`} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[9px] font-bold text-white leading-none">Music</p>
                    <p className="text-[8px] leading-none mt-0.5" style={{ color: musicOn ? '#c084fc' : '#475569' }}>
                      {musicOn ? '▶ Play' : 'Trap'}
                    </p>
                  </div>
                  <div className="relative flex-shrink-0 rounded-full" style={{ width: 24, height: 13, background: musicOn ? 'linear-gradient(90deg,#a855f7,#7c3aed)' : 'rgba(51,65,85,0.9)', boxShadow: musicOn ? '0 0 6px rgba(168,85,247,0.4)' : 'none', transition: 'background 0.25s' }}>
                    <div className="absolute rounded-full bg-white" style={{ width: 9, height: 9, top: 2, left: musicOn ? 13 : 2, transition: 'left 0.22s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </div>
                </button>

              </div>

              {/* Spotify embed — when music is ON */}
              {musicOn && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(168,85,247,0.22)' }}>
                  <iframe
                    src="https://open.spotify.com/embed/playlist/37i9dQZF1DX0XUsuxWHRQd?utm_source=generator&theme=0"
                    width="100%" height="80"
                    style={{ border: 'none', display: 'block' }}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Break / Resume — only when online */}
              {driverStatus !== 'offline' && (
                <div className="flex gap-2">
                  {isBusy && (
                    <div className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 rounded-lg px-2 py-1.5 flex-1 border border-orange-500/15">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Active delivery in progress
                    </div>
                  )}
                  {!isBusy && driverStatus !== 'on_break' && (
                    <button onClick={() => { playBreakSound(); setStatus('on_break'); }} disabled={togglingStatus}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-xl border border-yellow-500/25 text-yellow-400 bg-yellow-500/8 hover:bg-yellow-500/15 transition-colors">
                      <Coffee className="w-3 h-3" /> Take a Break
                    </button>
                  )}
                  {driverStatus === 'on_break' && (
                    <button onClick={() => { playRetakeSound(); setStatus('available'); }} disabled={togglingStatus}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-xl border border-green-500/25 text-green-400 bg-green-500/8 hover:bg-green-500/15 transition-colors">
                      <Power className="w-3 h-3" /> Retomar
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Driver card + stats — scrollable */}
      <div className="bg-gradient-to-b from-[#132640] to-[#0a1628]">
        <div className="px-4 pb-4">
          <div className="max-w-lg mx-auto">

            {/* Driver card */}
            <div className="flex items-center gap-4 rounded-2xl px-4 py-3.5 bg-white/6 border border-white/10">
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
                  {localTruckMake
                    ? <>{localTruckMake}<span className="text-slate-600"> · </span>{localEquipType || driver?.equipment_type || 'Driver'}</>
                    : (localEquipType || driver?.equipment_type || 'Driver')
                  }
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
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────── */}
        <div className="px-4 pb-5">
          <div className="max-w-lg mx-auto grid grid-cols-3 gap-2">
            <div className="rounded-2xl px-2 py-4 text-center bg-white/6 border border-white/10">
              <p className="text-2xl font-bold text-orange-400">{activeOrders.length}</p>
              <p className="text-xs mt-0.5 text-slate-500">Active Orders</p>
            </div>
            <button onClick={() => setTab('delivered')}
              className="rounded-2xl px-2 py-4 text-center active:scale-95 transition-transform w-full bg-white/6 border border-white/10">
              <p className="font-bold text-emerald-400 leading-tight"
                 style={{ fontSize: 'clamp(13px, 4vw, 18px)' }}>
                ${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs mt-0.5 text-slate-500">Today's Revenue</p>
            </button>
            <div className="rounded-2xl px-2 py-4 text-center bg-white/6 border border-white/10">
              <Award className="w-5 h-5 text-orange-400 mx-auto" />
              <p className="text-2xl font-bold text-orange-400 mt-0.5">{unlockedCount}<span className="text-sm text-orange-500/60 font-normal">/8</span></p>
              <p className="text-xs mt-0.5 text-slate-500">Logros</p>
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
        <div style={{ background: '#0a1628' }}>
        <div className="relative" style={{
          height: 'calc(100vh - 380px)', minHeight: 320,
          borderTop: '2px solid rgba(56,189,248,0.55)',
          borderBottom: '2px solid rgba(56,189,248,0.55)',
        }}>
          <Map3D driver={driver} activeOrders={activeOrders} pitch={52} />

          {/* Tech grid overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(rgba(56,189,248,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.025) 1px, transparent 1px)',
            backgroundSize: '44px 44px'
          }} />

          {/* Top HUD */}
          <div className="absolute top-0 inset-x-0 px-4 py-3 pointer-events-none" style={{
            background: 'linear-gradient(to bottom, rgba(2,6,23,0.82), transparent)'
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(34,211,238,0.8)' }} />
                <span className="text-[10px] font-bold text-cyan-400 tracking-[0.15em] uppercase">Live Tracking</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-300/60">
                {driver?.current_lat?.toFixed(4)}°N · {Math.abs(driver?.current_lng ?? 0).toFixed(4)}°W
              </span>
            </div>
          </div>

          {/* Bottom HUD */}
          <div className="absolute bottom-0 inset-x-0 px-4 py-3 pointer-events-none" style={{
            background: 'linear-gradient(to top, rgba(2,6,23,0.82), transparent)'
          }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/40 truncate max-w-[55%]">{driver?.current_address}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                <span className="text-[10px] font-mono text-white/50 tracking-widest">OFFLINE</span>
              </div>
            </div>
          </div>

          {/* Corner tech brackets */}
          {(['top-2.5 left-2.5 border-t-2 border-l-2','top-2.5 right-2.5 border-t-2 border-r-2',
             'bottom-2.5 left-2.5 border-b-2 border-l-2','bottom-2.5 right-2.5 border-b-2 border-r-2'] as string[]).map((cls, i) => (
            <div key={i} className={`absolute w-5 h-5 ${cls} border-cyan-400/60 pointer-events-none rounded-sm`} />
          ))}

          <div className="absolute inset-0 flex flex-col items-center justify-center px-5 pointer-events-none">
            <div className={`backdrop-blur-2xl rounded-3xl px-6 py-5 text-center w-full max-w-sm pointer-events-auto ${
              dark
                ? 'border border-white/[0.07]'
                : 'bg-white/95 border border-gray-200 shadow-xl'
            }`}
              style={dark ? {
                background: 'linear-gradient(160deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.90) 100%)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.06)',
              } : undefined}>

              {/* Divider superior — línea de acento rojo/amber para indicar offline */}
              {dark && (
                <div className="absolute top-0 inset-x-8 h-px rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent)' }} />
              )}

              {/* Icon con glow pulsante */}
              <div className="relative w-16 h-16 mx-auto mb-3">
                <div className={`absolute inset-0 rounded-2xl ${dark ? 'animate-pulse' : ''}`}
                  style={dark ? { background: 'rgba(239,68,68,0.12)', filter: 'blur(8px)', borderRadius: 18 } : undefined} />
                <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border ${
                  dark
                    ? 'border-white/[0.08]'
                    : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300'
                }`}
                  style={dark ? {
                    background: 'linear-gradient(145deg, rgba(30,41,59,1) 0%, rgba(15,23,42,1) 100%)',
                    boxShadow: '0 0 0 1px rgba(239,68,68,0.2), 0 4px 20px rgba(0,0,0,0.5)',
                  } : undefined}>
                  <Power className={`w-7 h-7 ${dark ? 'text-red-400/80' : 'text-gray-500'}`} />
                </div>
              </div>

              {/* Badge offline */}
              {dark && (
                <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" style={{ boxShadow: '0 0 4px rgba(239,68,68,0.8)' }} />
                  <span className="text-[10px] font-bold text-red-400 tracking-[0.12em] uppercase">Offline</span>
                </div>
              )}

              {/* Text */}
              <h3 className={`text-lg font-bold mb-1.5 tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}
                style={dark ? { textShadow: '0 1px 8px rgba(0,0,0,0.5)' } : undefined}>
                You're Offline
              </h3>
              <p className={`leading-relaxed ${dark ? 'text-slate-400 text-sm mb-4' : 'text-gray-500 text-sm mb-5'}`}>
                Conéctate para recibir ofertas de OSI Logistics
              </p>

              {/* CTA */}
              <button onClick={() => setStatus('available')} disabled={togglingStatus}
                className="w-full relative overflow-hidden active:scale-[0.97] disabled:opacity-60 transition-all duration-150 flex items-center justify-center gap-2 text-sm font-bold tracking-wide"
                style={{
                  borderRadius: 14,
                  padding: '13px 20px',
                  color: '#fff',
                  background: 'linear-gradient(160deg, #4ade80 0%, #22c55e 40%, #16a34a 100%)',
                  boxShadow: dark
                    ? '0 0 0 1px rgba(74,222,128,0.25), 0 6px 24px rgba(34,197,94,0.35), 0 1px 0 rgba(255,255,255,0.15) inset'
                    : '0 4px 16px rgba(34,197,94,0.4)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}>
                <span className="absolute inset-0 pointer-events-none rounded-xl"
                  style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.12) 0%,transparent 55%)' }} />
                {togglingStatus
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Power className="w-3.5 h-3.5" />}
                <span>Go Online Now</span>
              </button>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }} />
        </div>
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
            <div className="space-y-4">

              {deliveredToday.length > 0 && (() => {
                const grossRevenue  = todayRevenue;
                const driverNet     = grossRevenue * 0.92;
                const osiFee        = grossRevenue * 0.08;
                const avgPerLoad    = grossRevenue / deliveredToday.length;
                const bestLoad      = Math.max(...deliveredToday.map(o => o.price));
                const totalMiles    = deliveredToday.reduce((s, o) => s + (o.distance_km || 0), 0) * 0.621371;
                const ratePerMile   = totalMiles > 0 ? grossRevenue / totalMiles : 0;
                const fmt = (n: number, dec = 2) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

                return (
                  <>
                    {/* ── Revenue Hero ───────────────────────── */}
                    <div className="rounded-2xl overflow-hidden" style={{
                      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
                      boxShadow: '0 8px 32px rgba(5,150,105,0.35), inset 0 1px 0 rgba(167,243,208,0.15)'
                    }}>
                      <div className="px-5 pt-5 pb-4">
                        <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-widest mb-1">Today's Revenue</p>
                        <p className="text-4xl font-black text-white tracking-tight">${fmt(grossRevenue)}</p>
                        <p className="text-xs text-emerald-200/50 mt-1">{deliveredToday.length} entrega{deliveredToday.length !== 1 ? 's' : ''} completada{deliveredToday.length !== 1 ? 's' : ''} esta semana</p>
                      </div>
                      <div className="grid grid-cols-2 border-t border-white/10">
                        <div className="px-5 py-3 border-r border-white/10">
                          <p className="text-[9px] text-emerald-300/50 uppercase tracking-widest mb-0.5">Tu ganancia (92%)</p>
                          <p className="text-xl font-black text-emerald-300">${fmt(driverNet)}</p>
                        </div>
                        <div className="px-5 py-3">
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">OSI fee (8%)</p>
                          <p className="text-xl font-bold text-white/50">${fmt(osiFee)}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Quick Stats ─────────────────────────── */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700">
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{deliveredToday.length}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">Loads</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700">
                        <p className="text-base font-black text-gray-900 dark:text-white">${fmt(avgPerLoad, 0)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">Average</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700">
                        <p className="text-base font-black text-green-600">${fmt(bestLoad, 0)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">Best</p>
                      </div>
                    </div>

                    {/* ── Miles & Rate ────────────────────────── */}
                    {totalMiles > 0 && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl px-5 py-4 border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Miles</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">{totalMiles.toFixed(1)} <span className="text-sm font-normal text-gray-400">mi</span></p>
                        </div>
                        <div className="w-px h-10 bg-gray-100 dark:bg-slate-700" />
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Rate / Mile</p>
                          <p className="text-xl font-black text-blue-600">${ratePerMile.toFixed(2)}<span className="text-sm font-normal text-gray-400">/mi</span></p>
                        </div>
                      </div>
                    )}

                    {/* ── Section label ───────────────────────── */}
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">Detalle de cargas</p>
                  </>
                );
              })()}

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
                        <p className="text-xs text-gray-400 dark:text-slate-500">{format(new Date(order.delivered_at), 'MM/dd · HH:mm')}</p>
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
            <div className="space-y-4">

              {/* ── Premium Map Container ─────────────────────── */}
              <div className="relative rounded-3xl overflow-hidden" style={{
                height: 400,
                boxShadow: '0 0 0 1px rgba(56,189,248,0.3), 0 0 30px rgba(56,189,248,0.15), 0 0 60px rgba(56,189,248,0.07)'
              }}>
                <Map3D driver={driver} activeOrders={activeOrders} pitch={54} />

                {/* Tech grid overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'linear-gradient(rgba(56,189,248,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.025) 1px, transparent 1px)',
                  backgroundSize: '44px 44px'
                }} />

                {/* Top HUD bar */}
                <div className="absolute top-0 inset-x-0 px-4 py-3 pointer-events-none" style={{
                  background: 'linear-gradient(to bottom, rgba(2,6,23,0.82), transparent)'
                }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                      <span className="text-[10px] font-bold text-cyan-400 tracking-[0.15em] uppercase">Live Tracking</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300/60">
                      {driver.current_lat?.toFixed(4)}°N · {Math.abs(driver.current_lng ?? 0).toFixed(4)}°W
                    </span>
                  </div>
                </div>

                {/* Bottom HUD bar */}
                <div className="absolute bottom-0 inset-x-0 px-4 py-3 pointer-events-none" style={{
                  background: 'linear-gradient(to top, rgba(2,6,23,0.82), transparent)'
                }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40 truncate max-w-[55%]">{driver.current_address}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className="text-[10px] font-mono text-white/50 tracking-widest">{cfg.label.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Corner tech brackets */}
                {(['top-2.5 left-2.5 border-t-2 border-l-2','top-2.5 right-2.5 border-t-2 border-r-2',
                   'bottom-2.5 left-2.5 border-b-2 border-l-2','bottom-2.5 right-2.5 border-b-2 border-r-2'] as string[]).map((cls, i) => (
                  <div key={i} className={`absolute w-5 h-5 ${cls} border-cyan-400/60 pointer-events-none rounded-sm`} />
                ))}

              </div>

              {/* ── Navigation Buttons ───────────────────────── */}
              <div className="grid grid-cols-2 gap-2">
                <a href={
                    activeOrders.length > 0 && activeOrders[0].status === 'assigned'
                      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrders[0].pickup_address)}`
                      : activeOrders.length > 0
                        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrders[0].delivery_address)}`
                        : 'https://maps.google.com'
                  }
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center px-3 py-2 rounded-xl text-white font-bold transition-all active:scale-95 text-xs"
                  style={{
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    boxShadow: '0 3px 12px rgba(22,163,74,0.4)'
                  }}>
                  Google Maps
                </a>

                <a href="https://truckerpath.com"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center px-3 py-2 rounded-xl text-white font-bold transition-all active:scale-95 text-xs"
                  style={{
                    background: 'linear-gradient(135deg, #1a73e8 0%, #0b57d0 100%)',
                    boxShadow: '0 3px 12px rgba(26,115,232,0.4)'
                  }}>
                  Trucker Path
                </a>
              </div>

              {/* ── Active order quick nav ───────────────────── */}
              {activeOrders.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Navigation className="w-3 h-3" /> Orden activa
                  </p>
                  {activeOrders[0].status === 'assigned' && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrders[0].pickup_address)}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-between bg-white dark:bg-blue-900/30 rounded-xl px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-800/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Ir al Pickup</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[200px]">{activeOrders[0].pickup_address}</p>
                        </div>
                      </div>
                      <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </a>
                  )}
                  {['picked_up','in_transit'].includes(activeOrders[0].status) && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrders[0].delivery_address)}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-between bg-white dark:bg-blue-900/30 rounded-xl px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-800/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Ir al Delivery</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[200px]">{activeOrders[0].delivery_address}</p>
                        </div>
                      </div>
                      <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </a>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* Profile tab — visible regardless of online status */}
      {tab === 'profile' && driver && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          {/* Driver card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">

            {/* ── Banner header ── */}
            <div className="relative h-20 overflow-hidden" style={{
              background: 'linear-gradient(135deg, #0a1628 0%, #0f2035 35%, #0c2a45 65%, #152a40 100%)',
            }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 100% at 90% 50%, rgba(249,115,22,0.22) 0%, transparent 70%)' }} />
              <div className="absolute right-5 top-3 w-10 h-10 rounded-full border border-orange-400/20" />
              <div className="absolute right-12 top-5 w-5 h-5 rounded-full border border-orange-400/15" />
              <div className="absolute right-20 top-2 w-3 h-3 rounded-full bg-orange-500/10" />
              <div className="absolute right-4 bottom-2.5 text-[9px] font-bold tracking-[0.3em] text-white/30 uppercase select-none">OSI LOGISTICS · PARTNER</div>
            </div>

            {/* ── Avatar + info ── */}
            <div className="px-5 pb-5">
              <div className="flex items-end justify-between -mt-9 mb-3">
                <div className="relative">
                  <div className="w-[68px] h-[68px] rounded-[18px] flex items-center justify-center text-white font-extrabold flex-shrink-0 select-none"
                    style={{
                      fontSize: 22, letterSpacing: '-0.5px',
                      background: 'linear-gradient(135deg, #fb923c 0%, #f97316 55%, #ea580c 100%)',
                      boxShadow: '0 8px 24px rgba(249,115,22,0.45), 0 2px 6px rgba(0,0,0,0.18)',
                      border: '3px solid white',
                    }}>
                    {driver.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white dark:border-slate-800 shadow-sm" />
                </div>
                {driver.driver_code && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1 tracking-widest border bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700/40">
                    ID #{driver.driver_code}
                  </span>
                )}
              </div>

              <p className="font-extrabold text-gray-900 dark:text-white text-lg leading-tight mb-2">{driver.name}</p>

              <div className="space-y-1.5">
                {/* Email row */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <Send className="w-2.5 h-2.5 text-blue-500" />
                  </div>
                  <p className="text-xs text-blue-500 dark:text-blue-400 font-medium flex-1 truncate">{driver.email}</p>
                  {emailVerified
                    ? <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-500 flex-shrink-0"><CheckCircle className="w-3 h-3" /> OK</span>
                    : <button onClick={() => { setVerifying('email'); setCodeSent(false); setCodeInput(''); setVerifyMsg(''); }}
                        className="text-[9px] font-bold text-orange-500 hover:text-orange-600 flex-shrink-0">Verificar</button>
                  }
                </div>
                {/* Phone row */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-2.5 h-2.5 text-gray-500 dark:text-slate-400" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 flex-1">{driver.phone}</p>
                  {phoneVerified
                    ? <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-500 flex-shrink-0"><CheckCircle className="w-3 h-3" /> OK</span>
                    : <button onClick={() => { setVerifying('phone'); setCodeSent(false); setCodeInput(''); setVerifyMsg(''); }}
                        className="text-[9px] font-bold text-orange-500 hover:text-orange-600 flex-shrink-0">Verificar</button>
                  }
                </div>
                {/* Verification panel */}
                {verifying && (
                  <div className="mt-2 p-3 rounded-xl border border-orange-100 bg-orange-50 dark:bg-slate-700/60 dark:border-slate-600">
                    <p className="text-xs font-semibold text-gray-800 dark:text-white mb-2">
                      Verificar {verifying === 'email' ? 'correo' : 'teléfono'}
                    </p>
                    {!codeSent ? (
                      <button onClick={() => handleSendCode(verifying)} disabled={sendingCode}
                        className="w-full py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {sendingCode && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                        Enviar código de 6 dígitos
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-emerald-600 font-medium">✓ {verifyMsg}</p>
                        <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                          value={codeInput}
                          onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-3 py-2 rounded-lg text-center text-lg font-bold tracking-widest border border-gray-200 dark:border-slate-500 outline-none focus:ring-2 focus:ring-orange-400/40 bg-white dark:bg-slate-600 text-gray-900 dark:text-white" />
                        <button onClick={handleVerifyCode} disabled={verifyingCode || codeInput.length < 6}
                          className="w-full py-2 rounded-lg text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {verifyingCode && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                          Confirmar código
                        </button>
                      </div>
                    )}
                    {!codeSent && verifyMsg && <p className="text-[10px] text-red-500 mt-1">{verifyMsg}</p>}
                    {codeSent && verifyMsg && verifyMsg.includes('ncorrecto') && <p className="text-[10px] text-red-500 mt-1">{verifyMsg}</p>}
                    <button onClick={cancelVerify} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">Cancelar</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Stats grid ── */}
            <div className="border-t border-gray-100 dark:border-slate-700 mx-4 mb-1" />
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                { label: 'Total Deliveries', value: driver.total_deliveries,                icon: Package,   color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { label: 'On-Time Rate',     value: `${driver.on_time_rate.toFixed(0)}%`,   icon: Clock,     color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-500/10' },
                { label: 'License #',        value: driver.license_number,                  icon: FileText,  color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                { label: 'Rating',           value: `★ ${driver.rating.toFixed(1)}`,        icon: Star,      color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10' },
                { label: 'Lic. Expiry',      value: driver.license_expiry || '—',           icon: Calendar,  color: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-500/10' },
                { label: 'Hire Date',        value: driver.hire_date || '—',                icon: Briefcase, color: 'text-teal-500',   bg: 'bg-teal-50 dark:bg-teal-500/10' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className={`w-5 h-5 rounded-md ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-3 h-3 ${color}`} />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{label}</p>
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

          {/* Empresa / Autoridad */}
          {(driver.company_name || authorityNum) && (
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
                {authorityNum && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400">{isDotEquip ? 'DOT#' : 'MC#'}</span>
                    <span className="text-sm font-mono font-medium text-gray-800 dark:text-slate-200">{authorityNum}</span>
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
                  <span className="text-xs text-gray-500 dark:text-slate-400">Truck</span>
                  <span className={`text-sm font-semibold ${localTruckMake ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {localTruckMake || 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Trailer / Equipment</span>
                  <span className={`text-sm font-semibold ${localEquipType ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {localEquipType || 'Not set'}
                  </span>
                </div>
                {!EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
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
                  </>
                )}
                {EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Largo (pies)</span>
                      <span className={`text-sm font-semibold ${equipLength ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {equipLength || 'Not set'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Ancho (pies)</span>
                      <span className={`text-sm font-semibold ${equipWidth ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {equipWidth || 'Not set'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Capacidad de carga (lbs)</span>
                      <span className={`text-sm font-semibold ${loadCapacity ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {loadCapacity ? `${Number(loadCapacity).toLocaleString()} lbs` : 'Not set'}
                      </span>
                    </div>
                  </>
                )}
                {!localTruckMake && !truckNum && !trailerNum && (
                  <button onClick={() => setEditingEquip(true)}
                    className="w-full mt-1 py-2.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                    + Add equipment info
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Truck Make / Model</label>
                  <input type="text" placeholder="e.g. Volvo 860, Kenworth T680"
                    value={localTruckMake} onChange={e => setLocalTruckMake(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border-0 outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">Trailer / Equipment Type</label>
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
                {!EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
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
                  </>
                )}
                {EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Dimensiones (pies)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 block">Largo</label>
                          <input type="number" placeholder="ej. 16" value={equipLength} onChange={e => setEquipLength(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 block">Ancho</label>
                          <input type="number" placeholder="ej. 8" value={equipWidth} onChange={e => setEquipWidth(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Capacidad de carga (lbs)</label>
                      <input type="number" placeholder="ej. 10000" value={loadCapacity} onChange={e => setLoadCapacity(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                    </div>
                  </>
                )}
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

          {/* COI — Certificate of Insurance */}
          {(() => {
            const today = new Date();
            const expDate = coiExpiry ? new Date(coiExpiry + 'T00:00:00') : null;
            const daysLeft = expDate ? Math.ceil((expDate.getTime() - today.getTime()) / 86400000) : null;
            const isExpired = daysLeft !== null && daysLeft < 0;
            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
            const statusColor = isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : coiExpiry ? '#22c55e' : '#94a3b8';
            const statusLabel = isExpired ? `Vencido hace ${Math.abs(daysLeft!)} días` : isExpiringSoon ? `Vence en ${daysLeft} días` : coiExpiry ? 'Vigente' : coiFileName ? 'Sin vencimiento' : 'No cargado';
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">COI · Certificate of Insurance</h3>
                  </div>
                  <button onClick={() => setCoiEditing(v => !v)}
                    className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> {coiEditing ? 'Cerrar' : 'Editar'}
                  </button>
                </div>

                {/* Status row */}
                <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" style={{ color: statusColor }} />
                    <span className="text-sm text-gray-700 dark:text-slate-300 truncate max-w-[160px]">
                      {coiFileName || 'Sin archivo'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}18`, color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                {coiExpiry && !coiEditing && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-slate-400">Vencimiento: </span>
                    <span className="text-xs font-semibold" style={{ color: statusColor }}>
                      {new Date(coiExpiry + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {(isExpired || isExpiringSoon) && <AlertCircle className="w-3 h-3 ml-1" style={{ color: statusColor }} />}
                  </div>
                )}

                {coiEditing && (
                  <div className="mt-3 space-y-2.5">
                    {/* File upload */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5">Archivo (PDF, JPG, PNG)</p>
                      <label className="flex items-center gap-2 cursor-pointer min-w-0">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 transition-colors flex-1 min-w-0 overflow-hidden">
                          <Upload className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500 dark:text-slate-400 truncate min-w-0">
                            {coiFileName || 'Seleccionar archivo...'}
                          </span>
                        </div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            if (f && driverId) {
                              setCoiFileName(f.name);
                              await driversApi.update(driverId, { coi_filename: f.name }).catch(() => {});
                            }
                          }} />
                      </label>
                    </div>
                    {/* Expiry date */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Fecha de vencimiento</p>
                      <input type="date" value={coiExpiry}
                        onChange={async e => {
                          setCoiExpiry(e.target.value);
                          if (driverId) await driversApi.update(driverId, { coi_expiry: e.target.value }).catch(() => {});
                        }}
                        className="input text-sm w-full" />
                    </div>
                    {(coiFileName || coiExpiry) && (
                      <button onClick={async () => { setCoiFileName(''); setCoiExpiry(''); setCoiEditing(false); if (driverId) await driversApi.update(driverId, { coi_filename: '', coi_expiry: '' }).catch(() => {}); }}
                        className="text-xs text-red-400 hover:text-red-500 font-medium">
                        Eliminar COI
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Factoring */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Factoring</h3>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">Broker Check · NOA</p>
                </div>
              </div>
              <button onClick={() => setEditingFactoring(v => !v)}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                <Edit3 className="w-3 h-3" /> {editingFactoring ? 'Cerrar' : 'Editar'}
              </button>
            </div>

            {/* NOA badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${factoringNoa ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {factoringNoa ? '✓ NOA Activo' : 'Sin NOA'}
              </span>
              {factoringCompany && (
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{factoringCompany}</span>
              )}
            </div>

            {!factoringCompany && !editingFactoring && (
              <p className="text-xs text-gray-400 dark:text-slate-500">Sin información de factoring</p>
            )}

            {factoringCompany && !editingFactoring && (
              <div className="space-y-1 text-xs text-gray-500 dark:text-slate-400">
                {factoringPhone && <p className="flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0 text-indigo-400" />{factoringPhone}</p>}
                {factoringEmail && <p className="flex items-center gap-1"><Mail className="w-3 h-3 flex-shrink-0 text-indigo-400" />{factoringEmail}</p>}
              </div>
            )}

            {editingFactoring && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Empresa de Factoring</p>
                  <input className="input text-sm w-full" value={factoringCompany}
                    onChange={e => setFactoringCompany(e.target.value)}
                    placeholder="Ej: OTR Solutions, RTS Financial..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Teléfono</p>
                    <input className="input text-sm w-full" value={factoringPhone}
                      onChange={e => setFactoringPhone(e.target.value)}
                      placeholder="(800) 000-0000" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Email</p>
                    <input className="input text-sm w-full" value={factoringEmail}
                      onChange={e => setFactoringEmail(e.target.value)}
                      placeholder="noa@factor.com" />
                  </div>
                </div>
                {/* NOA toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 dark:bg-slate-700/50">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">NOA (Notice of Assignment)</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Brokers deben pagar a la empresa de factoring</p>
                  </div>
                  <button onClick={() => setFactoringNoa(v => !v)}
                    className="relative rounded-full flex-shrink-0 ml-3"
                    style={{ width: 36, height: 20, background: factoringNoa ? '#6366f1' : 'rgba(100,116,139,0.4)', transition: 'background 0.2s' }}>
                    <div className="absolute rounded-full bg-white"
                      style={{ width: 14, height: 14, top: 3, left: factoringNoa ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingFactoring(false)}
                    className="flex-1 text-xs py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500">
                    Cancelar
                  </button>
                  <button
                    disabled={savingFactoring}
                    onClick={async () => {
                      if (!driverId) return;
                      setSavingFactoring(true);
                      try {
                        await driversApi.update(driverId, {
                          factoring_company: factoringCompany,
                          factoring_phone:   factoringPhone,
                          factoring_email:   factoringEmail,
                          factoring_noa:     factoringNoa ? '1' : '0',
                        });
                        setEditingFactoring(false);
                      } catch {} finally { setSavingFactoring(false); }
                    }}
                    className="flex-1 text-xs py-1.5 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1">
                    {savingFactoring ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>

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
              <p className={`text-xs mt-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Por cada carga entregada, OSI toma solo el <span className={`font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>8%</span></p>
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

          {/* ── Método de Pago ───────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Método de Pago</h3>
              </div>
              {!editingPayout ? (
                <button onClick={() => setEditingPayout(true)}
                  className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold hover:text-green-700 dark:hover:text-green-300 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> {payoutMethod ? 'Editar' : 'Configurar'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingPayout(false)}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={savePayout} disabled={savingPayout}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50">
                    {savingPayout && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                    Guardar
                  </button>
                </div>
              )}
            </div>

            {!editingPayout ? (
              payoutMethod ? (
                <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-xl p-3">
                  <span className="text-2xl flex-shrink-0">{PAYOUT_OPTS.find(o => o.id === payoutMethod)?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{PAYOUT_OPTS.find(o => o.id === payoutMethod)?.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{payoutSummary(payoutMethod, payoutDetails)}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              ) : (
                <div className="text-center py-5">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <Wallet className="w-5 h-5 text-gray-300 dark:text-slate-600" />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">No tienes un método de pago configurado</p>
                  <button onClick={() => setEditingPayout(true)}
                    className="mt-2.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors">
                    + Configurar ahora
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {/* Method selector */}
                <div className="grid grid-cols-5 gap-1.5">
                  {PAYOUT_OPTS.map(opt => (
                    <button key={opt.id} onClick={() => setPayoutMethod(opt.id)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-center transition-colors ${
                        payoutMethod === opt.id
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}>
                      <span className="text-lg leading-none">{opt.icon}</span>
                      <span className="text-[9px] font-semibold leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {/* Fields per method */}
                {payoutMethod === 'zelle' && (
                  <input type="text" placeholder="Número o email de Zelle"
                    value={payoutDetails.contact || ''} onChange={e => updatePayoutDetail('contact', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
                {payoutMethod === 'paypal' && (
                  <input type="email" placeholder="Email de PayPal"
                    value={payoutDetails.email || ''} onChange={e => updatePayoutDetail('email', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
                {payoutMethod === 'venmo' && (
                  <input type="text" placeholder="@username de Venmo"
                    value={payoutDetails.username || ''} onChange={e => updatePayoutDetail('username', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
                {payoutMethod === 'ach' && (
                  <div className="space-y-2">
                    <input type="text" placeholder="Nombre del banco"
                      value={payoutDetails.bank || ''} onChange={e => updatePayoutDetail('bank', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                    <input type="text" placeholder="Número de cuenta"
                      value={payoutDetails.account || ''} onChange={e => updatePayoutDetail('account', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                    <input type="text" placeholder="Routing number"
                      value={payoutDetails.routing || ''} onChange={e => updatePayoutDetail('routing', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                  </div>
                )}
                {payoutMethod === 'check' && (
                  <input type="text" placeholder="Nombre para el cheque (a nombre de)"
                    value={payoutDetails.payable_to || ''} onChange={e => updatePayoutDetail('payable_to', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
              </div>
            )}
          </div>

          {/* Records */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-1 mb-2">Historial de pagos</p>
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
                            ${r.order_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} rate · 8% = <span className="font-semibold text-gray-600 dark:text-slate-300">${r.driver_charge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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

      {/* ── Hub tab ──────────────────────────────────────────── */}
      {tab === 'hub' && (
        <div className="max-w-lg mx-auto">

          {/* Sub-section pill tabs */}
          <div className="flex gap-1.5 px-4 pt-4 pb-3 sticky top-0 z-10 bg-gray-50 dark:bg-slate-900">
            {([
              { id: 'community' as const, icon: Users,     label: 'Comunidad' },
              { id: 'support'   as const, icon: PhoneCall, label: 'Support' },
              { id: 'radio'     as const, icon: Radio,     label: 'OSI Radio' },
            ]).map(s => (
              <button key={s.id} onClick={() => setHubSection(s.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  hubSection === s.id
                    ? 'bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-lg shadow-orange-500/25'
                    : 'text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700'
                }`}>
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          {/* ── COMUNIDAD ──────────────────────────────── */}
          {hubSection === 'community' && (
            <div className="px-4 pb-5 space-y-3">

              {/* Post composer */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm bg-gradient-to-br from-orange-400 to-orange-600 text-white">
                    {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D'}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={postText}
                      onChange={e => setPostText(e.target.value)}
                      placeholder="Comparte algo con la comunidad OSI..."
                      className="w-full text-sm bg-gray-50 dark:bg-slate-700 rounded-xl p-3 resize-none border-0 outline-none text-gray-800 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      rows={2}
                      maxLength={280}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-gray-300 dark:text-slate-600">{postText.length}/280</span>
                      <button
                        onClick={() => {
                          if (!postText.trim()) return;
                          const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D';
                          setCommunityPosts(prev => [{
                            id: Date.now().toString(),
                            avatar: initials,
                            name: driver?.name || user?.name || 'Driver',
                            time: 'ahora',
                            msg: postText.trim(),
                            likes: 0,
                            liked: false,
                          }, ...prev]);
                          setPostText('');
                        }}
                        disabled={!postText.trim()}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-400 active:scale-95 disabled:opacity-40 text-white transition-all">
                        Publicar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Posts feed */}
              {communityPosts.map(post => (
                <div key={post.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                      {post.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{post.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">{post.time} · OSI Fleet</p>
                    </div>
                    <span className="text-[10px] font-bold text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-full flex-shrink-0">OSI</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed mb-3">{post.msg}</p>
                  <div className="flex items-center gap-4 pt-2.5 border-t border-gray-50 dark:border-slate-700/60">
                    <button
                      onClick={() => setCommunityPosts(prev => prev.map(p =>
                        p.id === post.id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
                      ))}
                      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${post.liked ? 'text-red-500' : 'text-gray-400 dark:text-slate-500 hover:text-red-400'}`}>
                      <Heart className="w-3.5 h-3.5" style={{ fill: post.liked ? 'currentColor' : 'none' }} />
                      {post.likes}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-blue-400 transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Responder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SUPPORT ────────────────────────────────── */}
          {hubSection === 'support' && (
            <div className="px-4 pb-5 space-y-3">

              {/* Current dispatcher */}
              {activeOrders[0]?.dispatcher_name ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-500/25 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">Dispatcher Actual</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">{activeOrders[0].dispatcher_name}</p>
                    </div>
                  </div>
                  {activeOrders[0].dispatcher_code && (
                    <div className="flex items-center justify-between mb-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl px-3 py-2.5">
                      <span className="text-xs text-blue-400">Código dispatcher</span>
                      <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-300">{activeOrders[0].dispatcher_code}</span>
                    </div>
                  )}
                  <a href="tel:+17863334444"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-colors"
                    style={{ background: 'linear-gradient(90deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                    <PhoneCall className="w-4 h-4" /> Llamar al Dispatcher
                  </a>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center shadow-sm">
                  <Briefcase className="w-8 h-8 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-400 dark:text-slate-500">Sin carga activa asignada</p>
                  <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">El dispatcher aparece aquí cuando aceptas una oferta</p>
                </div>
              )}

              {/* OSI Contact Lines */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                    <PhoneCall className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">OSI Logistics — Contactos</p>
                </div>
                <div className="space-y-2.5">
                  {([
                    { label: 'Dispatch 24/7',          phone: '+1 (904) 945-1816', desc: 'Lunes a Domingo · 24 horas' },
                    { label: 'Soporte al Driver',       phone: '+1 (904) 610-3125', desc: 'Pagos · Issues técnicos' },
                  ]).map(c => (
                    <a key={c.phone} href={`tel:+${c.phone.replace(/\D/g,'')}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 hover:bg-orange-50 dark:hover:bg-orange-500/8 transition-colors group">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{c.label}</p>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{c.desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <span className="text-xs font-mono font-bold text-orange-500 whitespace-nowrap">{c.phone}</span>
                        <PhoneCall className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Resources */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Recursos</p>
                <div className="space-y-2">
                  {([
                    { label: 'Manual del Driver OSI',   icon: '📋', desc: 'Procedimientos y políticas' },
                    { label: 'Reportar Incidente',       icon: '⚠️', desc: 'Accidentes · Robos · Daños a carga' },
                    { label: 'Solicitar Ajuste de Rate', icon: '💰', desc: 'Negociar compensación de carga' },
                  ]).map(r => (
                    <button key={r.label}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 hover:bg-orange-50 dark:hover:bg-orange-500/8 transition-colors text-left">
                      <span className="text-lg flex-shrink-0">{r.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{r.label}</p>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── OSI RADIO ──────────────────────────────── */}
          {hubSection === 'radio' && (
            <div className="px-4 pb-5">

              {/* Radio header */}
              <div className="rounded-2xl overflow-hidden mb-3" style={{
                background: 'linear-gradient(135deg, #0a1628 0%, #0f1e35 100%)',
                border: '1px solid rgba(56,189,248,0.2)',
              }}>
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">OSI Radio</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-[11px] text-green-400">En línea · Canal OSI Fleet</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">LIVE</span>
                </div>

                {/* Messages */}
                <div ref={el => { radioScrollRef.current = el; }} className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: '36vh', background: 'rgba(5,12,24,0.6)' }}>
                  {radioMsgs.map(msg => {
                    const myName = driver?.name || user?.name;
                    const isMe = !!myName && msg.name === myName;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${isMe ? 'bg-orange-500' : 'bg-slate-600/80'} text-white`}>
                          {msg.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && <p className="text-[10px] text-slate-500 mb-0.5 ml-1">{msg.name}</p>}
                          {msg.type === 'voice' && msg.audioData ? (
                            <div className={`rounded-2xl px-3 py-2.5 min-w-[180px] ${isMe
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600 rounded-tr-sm'
                              : 'bg-slate-700/80 border border-white/5 rounded-tl-sm'
                            }`}>
                              {/* Voice message player */}
                              {(() => {
                                const isPlaying = playingMsgId === msg.id;
                                return (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        if (isPlaying) {
                                          radioAudioRef.current?.pause();
                                          radioAudioRef.current = null;
                                          setPlayingMsgId(null);
                                        } else {
                                          if (radioAudioRef.current) {
                                            radioAudioRef.current.pause();
                                            radioAudioRef.current = null;
                                          }
                                          const audio = new Audio(msg.audioData!);
                                          audio.onended = () => setPlayingMsgId(null);
                                          audio.onpause = () => setPlayingMsgId(prev => prev === msg.id ? null : prev);
                                          radioAudioRef.current = audio;
                                          audio.play().catch(() => setPlayingMsgId(null));
                                          setPlayingMsgId(msg.id);
                                        }
                                      }}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 ${isMe ? 'bg-white/20 hover:bg-white/30' : 'bg-cyan-500/20 hover:bg-cyan-500/30'}`}>
                                      {isPlaying ? (
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-white">
                                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                        </svg>
                                      ) : (
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-white" style={{ marginLeft: 2 }}>
                                          <path d="M8 5v14l11-7z"/>
                                        </svg>
                                      )}
                                    </button>
                                    {/* Waveform bars — animate while playing */}
                                    <div className="flex items-center gap-[2px] flex-1">
                                      {[4,8,12,6,10,14,8,5,11,9,13,7,10,6,8,12,5,9].map((h, i) => (
                                        <div key={i} className={`rounded-full flex-shrink-0 ${isMe ? 'bg-white/75' : 'bg-cyan-400/70'}`}
                                          style={{
                                            width: 2,
                                            height: h,
                                            transformOrigin: 'center',
                                            animation: isPlaying ? `waveBar ${0.32 + (i % 6) * 0.07}s ease-in-out infinite alternate` : 'none',
                                            animationDelay: isPlaying ? `${i * 0.04}s` : '0s',
                                          }} />
                                      ))}
                                    </div>
                                    <span className={`text-[10px] font-mono flex-shrink-0 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                      {String(Math.floor((msg.duration||0)/60)).padStart(1,'0')}:{String(Math.round((msg.duration||0)%60)).padStart(2,'0')}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className={`rounded-2xl px-3 py-2 ${isMe
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-sm'
                              : 'bg-slate-700/80 text-slate-200 border border-white/5 rounded-tl-sm'
                            }`}>
                              <p className="text-sm leading-snug">{msg.msg}</p>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-600 mt-0.5 mx-1">{format(new Date(msg.ts), 'HH:mm')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Walkie-Talkie PTT Zone ── */}
                <div style={{ borderTop: '1px solid rgba(56,189,248,0.12)', background: 'rgba(4,8,18,0.95)' }}>

                  {/* Recording status bar */}
                  {isRecording && (
                    <div className="flex items-center justify-between px-4 py-1.5" style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
                        <span className="text-[11px] font-bold text-red-400 tracking-widest uppercase">Transmitting</span>
                      </div>
                      <span className="text-[11px] font-mono text-red-400">
                        {String(Math.floor(recordingDuration/60)).padStart(1,'0')}:{String(recordingDuration%60).padStart(2,'0')}
                      </span>
                    </div>
                  )}

                  {/* PTT — OSI Fleet Radio PRO X7 v5 — compact */}
                  <div className="flex flex-col items-center pt-1 pb-3 px-4 gap-2">

                    <div style={{ position: 'relative', width: 162, height: 318,
                      filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.98)) drop-shadow(0 5px 12px rgba(0,0,0,0.85))' }}>

                      {/* ANTENNA */}
                      <div style={{ position: 'absolute', right: 17, top: 0, width: 11, height: 56, borderRadius: '5px 5px 2px 2px',
                        background: ['repeating-linear-gradient(180deg,rgba(255,255,255,0.08) 0px,rgba(255,255,255,0.08) 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 3.5px,transparent 3.5px,transparent 7px)','linear-gradient(to right,#020810 0%,#0a1824 18%,#152334 50%,#0a1824 82%,#020810 100%)'].join(','),
                        boxShadow: '3px 0 10px rgba(0,0,0,0.95)', transform: 'rotate(7deg)', transformOrigin: 'bottom center',
                      }} />
                      <div style={{ position: 'absolute', right: 18, top: -3, width: 10, height: 10, borderRadius: '50%',
                        background: 'radial-gradient(circle at 30% 26%,#ffffff 0%,#e2e8f0 18%,#94a3b8 48%,#334155 78%,#0f172a 100%)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.98)', transform: 'rotate(7deg) translateY(-4px)', transformOrigin: '50% 60px',
                      }} />

                      {/* MAIN BODY — content must fit in 270px height */}
                      <div style={{ position: 'absolute', left: 0, top: 48, width: 155, bottom: 0,
                        borderRadius: '13px 18px 11px 11px', overflow: 'hidden',
                        background: ['linear-gradient(to right,rgba(255,255,255,0.18) 0px,rgba(255,255,255,0.07) 4px,rgba(255,255,255,0.02) 12px,transparent 22px)','radial-gradient(ellipse 90% 20% at 46% 0%,rgba(255,255,255,0.07) 0%,transparent 100%)','repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,255,255,0.004) 2px,rgba(255,255,255,0.004) 3px)','linear-gradient(158deg,#171d2a 0%,#0e1320 12%,#090c18 32%,#050810 58%,#020408 100%)'].join(','),
                        boxShadow: ['inset -3px 0 10px rgba(0,0,0,0.72)','inset 0 -4px 14px rgba(0,0,0,0.82)','inset 1px 1px 0 rgba(255,255,255,0.15)'].join(','),
                      }}>

                        {/* CHROME RAIL */}
                        <div style={{ height: 16, borderRadius: '13px 18px 0 0',
                          background: 'linear-gradient(180deg,#b0bac8 0%,#d8dfe8 8%,#edf1f6 18%,#f8fafc 32%,#ffffff 46%,#f4f7fa 58%,#dde3ec 72%,#bdc6d2 84%,#8d9aaa 94%,#6b7888 100%)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.88), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.28)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px',
                        }}>
                          <div style={{ display: 'flex', gap: 5 }}><div style={{ position: 'relative', width: 6, height: 6, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%,#c4cdd8 0%,#8892a0 40%,#3d4856 80%,#1e2530 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(0,0,0,0.5)' }}>
                              <div style={{ position: 'absolute', top: '20%', left: '47%', width: 0.8, height: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateX(-50%)' }} />
                              <div style={{ position: 'absolute', top: '47%', left: '20%', height: 0.8, width: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateY(-50%)' }} />
                            </div><div style={{ position: 'relative', width: 6, height: 6, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%,#c4cdd8 0%,#8892a0 40%,#3d4856 80%,#1e2530 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(0,0,0,0.5)' }}>
                              <div style={{ position: 'absolute', top: '20%', left: '47%', width: 0.8, height: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateX(-50%)' }} />
                              <div style={{ position: 'absolute', top: '47%', left: '20%', height: 0.8, width: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateY(-50%)' }} />
                            </div></div>
                          <span style={{ fontSize: 5.5, letterSpacing: '0.38em', fontFamily: 'Arial', fontWeight: 900, color: '#3d4856', textShadow: '0 1px 0 rgba(255,255,255,0.65)' }}>OSI · PRO X7</span>
                          <div style={{ display: 'flex', gap: 5 }}><div style={{ position: 'relative', width: 6, height: 6, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%,#c4cdd8 0%,#8892a0 40%,#3d4856 80%,#1e2530 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(0,0,0,0.5)' }}>
                              <div style={{ position: 'absolute', top: '20%', left: '47%', width: 0.8, height: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateX(-50%)' }} />
                              <div style={{ position: 'absolute', top: '47%', left: '20%', height: 0.8, width: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateY(-50%)' }} />
                            </div><div style={{ position: 'relative', width: 6, height: 6, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%,#c4cdd8 0%,#8892a0 40%,#3d4856 80%,#1e2530 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(0,0,0,0.5)' }}>
                              <div style={{ position: 'absolute', top: '20%', left: '47%', width: 0.8, height: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateX(-50%)' }} />
                              <div style={{ position: 'absolute', top: '47%', left: '20%', height: 0.8, width: '60%', background: 'rgba(0,0,0,0.45)', transform: 'translateY(-50%)' }} />
                            </div></div>
                        </div>

                        {/* KNOBS ROW */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ position: 'relative', width: 32, height: 32 }}>
                              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(from 0deg,#040a14 0deg,#0c1a28 9deg,#162638 14deg,#0c1a28 19deg,#040a14 28deg,#0c1a28 38deg,#162638 43deg,#0c1a28 48deg,#040a14 57deg,#0c1a28 67deg,#162638 72deg,#0c1a28 77deg,#040a14 86deg,#0c1a28 96deg,#162638 101deg,#0c1a28 106deg,#040a14 115deg,#0c1a28 125deg,#162638 130deg,#0c1a28 135deg,#040a14 144deg,#0c1a28 154deg,#162638 159deg,#0c1a28 164deg,#040a14 173deg,#0c1a28 183deg,#162638 188deg,#0c1a28 193deg,#040a14 202deg,#0c1a28 212deg,#162638 217deg,#0c1a28 222deg,#040a14 231deg,#0c1a28 241deg,#162638 246deg,#0c1a28 251deg,#040a14 260deg,#0c1a28 270deg,#162638 275deg,#0c1a28 280deg,#040a14 289deg,#0c1a28 299deg,#162638 304deg,#0c1a28 309deg,#040a14 318deg,#0c1a28 328deg,#162638 333deg,#0c1a28 338deg,#040a14 347deg,#0c1a28 357deg,#162638 360deg)', boxShadow: '0 3px 10px rgba(0,0,0,0.97), inset 0 2px 4px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.055)' }} />
                              <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'linear-gradient(135deg,#818c9e 0%,#d1d9e6 22%,#f4f6f9 46%,#d1d9e6 70%,#818c9e 100%)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.3)' }} />
                              <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: 'radial-gradient(circle at 33% 28%,#223448 0%,#111f30 42%,#060c18 100%)', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.96)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2 }}>
                                <div style={{ width: 2.5, height: 4, borderRadius: '0 0 2px 2px', background: '#f97316', boxShadow: '0 0 7px #f97316' }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 5.5, letterSpacing: '0.2em', color: 'rgba(100,130,180,0.6)', fontFamily: 'Arial', fontWeight: 800 }}>VOL</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 6, letterSpacing: '0.3em', color: 'rgba(148,163,184,0.4)', fontFamily: 'Arial', fontWeight: 900 }}>OSI</span>
                            <div style={{ width: 11, height: 11, borderRadius: '50%',
                              background: isRecording ? 'radial-gradient(circle at 34% 30%,#fecaca 0%,#ef4444 50%,#7f1d1d 100%)' : 'radial-gradient(circle at 34% 30%,#bbf7d0 0%,#22c55e 50%,#14532d 100%)',
                              boxShadow: isRecording ? '0 0 0 2.5px rgba(239,68,68,0.18), 0 0 18px 5px rgba(239,68,68,0.94)' : '0 0 0 2.5px rgba(34,197,94,0.16), 0 0 18px 5px rgba(34,197,94,0.9)',
                              transition: 'all 0.2s',
                            }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ position: 'relative', width: 32, height: 32 }}>
                              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(from 0deg,#040a14 0deg,#0c1a28 9deg,#162638 14deg,#0c1a28 19deg,#040a14 28deg,#0c1a28 38deg,#162638 43deg,#0c1a28 48deg,#040a14 57deg,#0c1a28 67deg,#162638 72deg,#0c1a28 77deg,#040a14 86deg,#0c1a28 96deg,#162638 101deg,#0c1a28 106deg,#040a14 115deg,#0c1a28 125deg,#162638 130deg,#0c1a28 135deg,#040a14 144deg,#0c1a28 154deg,#162638 159deg,#0c1a28 164deg,#040a14 173deg,#0c1a28 183deg,#162638 188deg,#0c1a28 193deg,#040a14 202deg,#0c1a28 212deg,#162638 217deg,#0c1a28 222deg,#040a14 231deg,#0c1a28 241deg,#162638 246deg,#0c1a28 251deg,#040a14 260deg,#0c1a28 270deg,#162638 275deg,#0c1a28 280deg,#040a14 289deg,#0c1a28 299deg,#162638 304deg,#0c1a28 309deg,#040a14 318deg,#0c1a28 328deg,#162638 333deg,#0c1a28 338deg,#040a14 347deg,#0c1a28 357deg,#162638 360deg)', boxShadow: '0 3px 10px rgba(0,0,0,0.97), inset 0 2px 4px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.055)' }} />
                              <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'linear-gradient(135deg,#818c9e 0%,#d1d9e6 22%,#f4f6f9 46%,#d1d9e6 70%,#818c9e 100%)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.3)' }} />
                              <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: 'radial-gradient(circle at 33% 28%,#223448 0%,#111f30 42%,#060c18 100%)', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.96)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2 }}>
                                <div style={{ width: 2.5, height: 4, borderRadius: '0 0 2px 2px', background: '#64748b', boxShadow: '0 0 7px #64748b' }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 5.5, letterSpacing: '0.2em', color: 'rgba(100,130,180,0.6)', fontFamily: 'Arial', fontWeight: 800 }}>CH</span>
                          </div>
                        </div>

                        {/* SPEAKER DISC — 78px, compact */}
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 4px' }}>
                          <div style={{ position: 'relative', width: 78, height: 78, borderRadius: '50%',
                            border: '2.5px solid #020406', background: '#010205',
                            boxShadow: 'inset 0 6px 22px rgba(0,0,0,1), 0 2px 8px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
                            overflow: 'hidden',
                          }}>
                            <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', overflow: 'hidden',
                              backgroundImage: 'radial-gradient(circle at 1.5px 1.5px,#04080e 1.6px,transparent 1.6px)',
                              backgroundSize: '4.5px 4.5px', backgroundRepeat: 'repeat',
                            }} />
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                              background: 'radial-gradient(circle at 50% 52%,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.38) 42%,transparent 68%)',
                            }} />
                            {isRecording && [14,24,34].map((r,i) => (
                              <div key={i} style={{ position: 'absolute', top: '50%', left: '50%',
                                width: r*2, height: r*2, marginLeft: -r, marginTop: -r, borderRadius: '50%',
                                border: `1.5px solid rgba(34,197,94,${0.6-i*0.18})`,
                                animation: `pttRing ${0.85+i*0.3}s ease-out infinite`,
                                animationDelay: `${i*0.18}s`,
                              }} />
                            ))}
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                              background: 'radial-gradient(ellipse 55% 38% at 30% 24%,rgba(255,255,255,0.06) 0%,transparent 100%)',
                              pointerEvents: 'none',
                            }} />
                          </div>
                        </div>

                        {/* LCD SCREEN — 44px */}
                        <div style={{ margin: '0 8px 5px', borderRadius: 7, border: '2.5px solid #010203',
                          boxShadow: 'inset 0 6px 18px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.04)',
                          position: 'relative', overflow: 'hidden', background: '#000',
                        }}>
                          <div style={{ height: 50, background: isRecording ? 'linear-gradient(180deg,#050f08 0%,#020804 100%)' : 'linear-gradient(180deg,#030c06 0%,#010503 100%)',
                            display: 'flex', alignItems: 'stretch', padding: '4px 6px', transition: 'background 0.3s' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
                                {[3,5,7,9,12].map((h,i) => (
                                  <div key={i} style={{ width: 3, height: h, borderRadius: '1px 1px 0 0',
                                    background: isRecording ? (i < 4 ? '#22c55e' : '#0a2a12') : (i < 3 ? '#22c55e' : '#0a2a12'),
                                    boxShadow: (isRecording ? i < 4 : i < 3) ? '0 0 4px rgba(34,197,94,0.6)' : 'none',
                                    animation: isRecording && i < 4 ? `waveBar ${0.24+i*0.08}s ease-in-out infinite alternate` : 'none',
                                    transition: 'background 0.22s',
                                  }} />
                                ))}
                              </div>
                              <div>
                                <div style={{ fontSize: 5.5, color: isRecording ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.24)', fontFamily: '"Courier New",monospace', letterSpacing: '0.08em' }}>CANAL</div>
                                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: '"Courier New",monospace', lineHeight: 1,
                                  color: isRecording ? '#22c55e' : '#145a24',
                                  textShadow: isRecording ? '0 0 12px rgba(34,197,94,1), 0 0 24px rgba(34,197,94,0.4)' : 'none',
                                  transition: 'all 0.22s',
                                }}>{isRecording ? 'TX' : '01'}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <div style={{ display: 'flex', gap: 1, border: `1px solid ${isRecording ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.22)'}`, borderRadius: 2, padding: '1px 1.5px' }}>
                                  {[0,1,2,3].map(i => <div key={i} style={{ width: 3, height: 6, borderRadius: 1, background: isRecording ? '#16a34a' : '#14532d', transition: 'all 0.2s' }} />)}
                                </div>
                                <div style={{ width: 1.5, height: 4, borderRadius: '0 1px 1px 0', background: isRecording ? '#22c55e' : '#166534' }} />
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 5.5, color: isRecording ? 'rgba(34,197,94,0.42)' : 'rgba(34,197,94,0.2)', fontFamily: '"Courier New",monospace' }}>MHz</div>
                                <div style={{ fontSize: 9, fontWeight: 900, fontFamily: '"Courier New",monospace',
                                  color: isRecording ? '#22c55e' : '#155724',
                                  textShadow: isRecording ? '0 0 8px rgba(34,197,94,0.88)' : 'none',
                                  transition: 'all 0.22s',
                                }}>154.310</div>
                              </div>
                            </div>
                          </div>
                          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,0.2) 0px,rgba(0,0,0,0.2) 1px,transparent 1px,transparent 3px)' }} />
                          <div style={{ position: 'absolute', top: 3, left: 5, width: 36, height: 12, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(255,255,255,0.17) 0%,rgba(255,255,255,0.04) 55%,transparent 100%)', transform: 'rotate(-12deg)', pointerEvents: 'none' }} />
                        </div>

                        {/* PTT BUTTON — GRABAR / DETENER */}
                        <button
                          onClick={async () => {
                            if (isRecording) {
                              if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
                              setIsRecording(false); setMediaRecorder(null);
                              return;
                            }
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                              try {
                                const ctx = new AudioContext();
                                const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
                                const d = buf.getChannelData(0);
                                for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
                                const src = ctx.createBufferSource();
                                const g = ctx.createGain(); g.gain.value = 0.3;
                                src.buffer = buf; src.connect(g); g.connect(ctx.destination); src.start();
                              } catch {}
                              const chunks: BlobPart[] = [];
                              const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
                              mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                              const startTime = Date.now();
                              mr.onstop = () => {
                                stream.getTracks().forEach(t => t.stop());
                                const blob = new Blob(chunks, { type: mr.mimeType });
                                const dur = Math.round((Date.now() - startTime) / 1000);
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const audioData = reader.result as string;
                                  const sock = getSocket();
                                  const name = driver?.name || user?.name || 'Driver';
                                  sock.emit('radio:voice', { name, audioData, duration: dur });
                                  setRadioMsgs(prev => [...prev, { id: Date.now().toString(), name, msg: '', type: 'voice', audioData, duration: dur, ts: new Date().toISOString() }]);
                                };
                                reader.readAsDataURL(blob);
                                try {
                                  const ctx = new AudioContext();
                                  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
                                  const d = buf.getChannelData(0);
                                  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.6;
                                  const src = ctx.createBufferSource();
                                  const g = ctx.createGain(); g.gain.value = 0.25;
                                  src.buffer = buf; src.connect(g); g.connect(ctx.destination); src.start();
                                } catch {}
                              };
                              mr.start(); setMediaRecorder(mr); setIsRecording(true); setRecordingDuration(0);
                            } catch {}
                          }}
                          className="select-none touch-none transition-transform active:scale-[0.955] block"
                          style={{
                            margin: '0 8px 0', width: 'calc(100% - 16px)', height: 52,
                            borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: isRecording
                              ? ['repeating-linear-gradient(135deg,rgba(0,0,0,0.1) 0px,rgba(0,0,0,0.1) 2px,transparent 2px,transparent 6px)','linear-gradient(180deg,#f87171 0%,#ef4444 36%,#991b1b 100%)'].join(',')
                              : ['repeating-linear-gradient(135deg,rgba(0,0,0,0.09) 0px,rgba(0,0,0,0.09) 2px,transparent 2px,transparent 6px)','linear-gradient(180deg,#fb923c 0%,#f97316 36%,#b45309 100%)'].join(','),
                            boxShadow: isRecording
                              ? 'inset 0 -6px 16px rgba(0,0,0,0.65), inset 0 3px 8px rgba(255,100,100,0.18), 0 0 28px rgba(239,68,68,0.82), 0 4px 12px rgba(0,0,0,0.9)'
                              : 'inset 0 -6px 16px rgba(0,0,0,0.55), inset 0 3px 8px rgba(255,185,100,0.14), 0 0 18px rgba(249,115,22,0.48), 0 4px 12px rgba(0,0,0,0.9)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            transition: 'all 0.15s',
                          }}
                        >
                          {/* Left ridge */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[0,1,2,3].map(i => <div key={i} style={{ width: 3, height: 5, borderRadius: 1.5, background: 'rgba(255,255,255,0.28)' }} />)}
                          </div>
                          {/* Center content */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            {/* Signal dot */}
                            <div style={{ width: 7, height: 7, borderRadius: '50%',
                              background: isRecording ? '#fff' : 'rgba(255,255,255,0.7)',
                              boxShadow: isRecording ? '0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.5)' : 'none',
                              animation: isRecording ? 'pulse-dot 0.8s ease-in-out infinite' : 'none',
                              transition: 'all 0.2s',
                            }} />
                            {/* PTT text */}
                            <span style={{
                              fontSize: 15, fontWeight: 900, letterSpacing: '0.3em',
                              fontFamily: 'Arial Black, Arial, sans-serif',
                              color: 'rgba(255,255,255,0.95)',
                              textShadow: isRecording
                                ? '0 0 12px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.6)'
                                : '0 2px 6px rgba(0,0,0,0.6)',
                              lineHeight: 1,
                              transition: 'text-shadow 0.2s',
                            }}>PTT</span>
                            {/* Sub label */}
                            <span style={{ fontSize: 5.5, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)', fontFamily: 'Arial', fontWeight: 700 }}>
                              {isRecording ? 'TRANSMITTING' : 'PUSH  TO  TALK'}
                            </span>
                          </div>
                          {/* Right ridge */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[0,1,2,3].map(i => <div key={i} style={{ width: 3, height: 5, borderRadius: 1.5, background: 'rgba(255,255,255,0.28)' }} />)}
                          </div>
                        </button>

                        {/* State label + brand */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8, paddingTop: 4, gap: 3 }}>
                          {isRecording ? (
                            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.16em', color: '#f87171', textTransform: 'uppercase', fontFamily: 'Arial', textShadow: '0 0 10px rgba(239,68,68,0.7)', animation: 'pulse-dot 1s ease-in-out infinite' }}>
                              ● Toca para detener
                            </span>
                          ) : (
                            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(251,146,60,0.75)', textTransform: 'uppercase', fontFamily: 'Arial' }}>
                              Toca para grabar
                            </span>
                          )}
                          <span style={{ fontSize: 5.5, letterSpacing: '0.35em', fontWeight: 900, fontFamily: 'Arial', color: 'rgba(71,85,105,0.38)', textTransform: 'uppercase' }}>OSI · FLEET RADIO</span>
                        </div>

                      </div>{/* end body */}

                      {/* Side PTT bar */}
                      <div style={{ position: 'absolute', left: -6, top: 98, width: 8, height: 58, borderRadius: '4px 0 0 4px',
                        background: isRecording ? 'linear-gradient(to right,#ef4444,#dc2626 60%,#991b1b 100%)' : 'linear-gradient(to right,#f97316,#ea580c 60%,#c2410c 100%)',
                        boxShadow: isRecording ? '-4px 0 14px rgba(239,68,68,0.75)' : '-4px 0 14px rgba(249,115,22,0.6)',
                        transition: 'all 0.3s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                        {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 1.5, borderRadius: 1, background: 'rgba(255,255,255,0.35)' }} />)}
                      </div>

                    </div>{/* end drop-shadow wrapper */}
                    <p className="text-[9px] text-slate-500 tracking-wider uppercase">OSI Fleet · Canal Seguro</p>
                  </div>

                  {/* Text input row */}
                  <div className="flex gap-2 px-4 pb-3">
                    <input
                      value={radioInput}
                      onChange={e => setRadioInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key !== 'Enter' || e.shiftKey || !radioInput.trim()) return;
                        e.preventDefault();
                        const sock = getSocket();
                        const name = driver?.name || user?.name || 'Driver';
                        sock.emit('radio:msg', { name, msg: radioInput.trim() });
                        setRadioMsgs(prev => [...prev, { id: Date.now().toString(), name, msg: radioInput.trim(), type: 'text', ts: new Date().toISOString() }]);
                        setRadioInput('');
                      }}
                      placeholder="Mensaje de texto al canal..."
                      className="flex-1 text-xs text-white placeholder:text-slate-600 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500/30"
                      style={{ background: 'rgba(15,30,53,0.7)', border: '1px solid rgba(56,189,248,0.1)' }}
                    />
                    <button
                      onClick={() => {
                        if (!radioInput.trim()) return;
                        const sock = getSocket();
                        const name = driver?.name || user?.name || 'Driver';
                        sock.emit('radio:msg', { name, msg: radioInput.trim() });
                        setRadioMsgs(prev => [...prev, { id: Date.now().toString(), name, msg: radioInput.trim(), type: 'text', ts: new Date().toISOString() }]);
                        setRadioInput('');
                      }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                      style={{ background: radioInput.trim() ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(51,65,85,0.4)' }}>
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Bottom Navigation ─────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-700 flex items-stretch">
        {([
          { id: 'active',    icon: Activity,    label: 'Active',  badge: activeOrders.length },
          { id: 'delivered', icon: CheckCircle, label: 'Done',    badge: deliveredToday.length },
          { id: 'map',       icon: Navigation,  label: 'Map',     badge: 0 },
          { id: 'hub',       icon: Users,       label: 'Hub',     badge: 0 },
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
              <div className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 transition-colors ${
                offerCountdown <= 60 ? 'border-red-300 bg-red-500/40' : 'border-white/40 bg-white/20'
              }`}>
                <span className={`font-bold text-sm leading-tight ${offerCountdown <= 60 ? 'text-red-100' : 'text-white'}`}>
                  {String(Math.floor(offerCountdown / 3600)).padStart(2,'0')}:{String(Math.floor((offerCountdown % 3600) / 60)).padStart(2,'0')}
                </span>
                <span className={`text-[9px] ${offerCountdown <= 60 ? 'text-red-200' : 'text-orange-200'}`}>
                  {String(offerCountdown % 60).padStart(2,'0')}s
                </span>
              </div>
            </div>
            {/* Timer bar */}
            <div className="h-1.5 bg-gray-100 dark:bg-slate-700">
              <div
                className={`h-full transition-all duration-1000 ${offerCountdown <= 60 ? 'bg-red-500' : 'bg-orange-400'}`}
                style={{ width: `${(offerCountdown / 7200) * 100}%` }}
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
                    stopAlarm();
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
                    stopAlarm();
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
