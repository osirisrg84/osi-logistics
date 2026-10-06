import { useState, useEffect, useCallback, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '../services/firebase';
import {
  Package, MapPin, CheckCircle, Truck, Phone,
  Clock, Star, Navigation, LogOut, User, Activity,
  Power, Coffee, AlertTriangle, Sun, Moon, Plus, X, Home, Briefcase, Wallet, Building2, CreditCard,
  Lock, ShieldCheck, Send, Bell, BellOff, CheckCheck, Award, Edit3, Zap,
  Headphones, Radio, Users, PhoneCall, MessageSquare, Heart, Trophy, DollarSign,
  FileText, Upload, Calendar, AlertCircle, Mail, Languages
} from 'lucide-react';
import osiLogo from '../assets/osi-logo.jpeg';
import InstallAppButton from '../components/InstallAppButton';
import InstallAppBanner from '../components/InstallAppBanner';
import { setAppManifest, setThemeColor, DRIVER_MANIFEST, DISPATCH_MANIFEST, DRIVER_COLOR, DISPATCH_COLOR } from '../utils/appManifest';
import { formatLocation } from '../utils/location';
import { useDriverAuth } from '../context/DriverAuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { ordersApi, driversApi, billingApi, notificationsApi, userApi, driverAxios, communityApi, analyticsApi, incidentsApi, assistantApi } from '../services/driverApi';
import { StripeCardPayment } from '../components/StripeCardPayment';
import { IncidentReportModal } from '../components/IncidentReportModal';
import { AiAssistantPanel } from '../components/AiAssistantPanel';
import { Order, Driver, DriverStatus, OrderDocument, ORDER_DOCUMENT_TYPE_LABELS } from '../types';
import { OrderStatusBadge, PriorityBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '../services/socket';
import Map3D from '../components/Map3D';
import { playNotificationPing, playSuccessChime } from '../utils/sounds';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

// Un solo AudioContext compartido para toda la pagina (no uno nuevo por
// sonido) -- los navegadores solo dejan que un AudioContext realmente suene
// si se crea/reanuda como resultado DIRECTO de un gesto del usuario. La
// alarma de "nueva oferta" la dispara un evento de socket asincrono (nadie
// tocó la pantalla justo en ese instante), asi que un `new AudioContext()`
// ahi nace "suspended" y no suena, sin lanzar ningun error -- exactamente el
// bug reportado ("no le suena el telefono al conductor"). Se desbloquea/
// reanuda con CUALQUIER toque en cualquier parte de la pagina (no solo el
// primero -- ver nota abajo), y de ahi en adelante todos los sonidos (oferta,
// aceptar, entregado, etc.) reusan ese mismo contexto ya activo en vez de
// crear uno nuevo suspendido cada vez.
let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume().catch(() => {});
  return sharedAudioCtx;
}
if (typeof window !== 'undefined') {
  const unlockSharedAudioContext = () => { getSharedAudioContext(); };
  // SIN {once:true} a proposito -- Chrome/Android puede volver a "suspender"
  // un AudioContext que llevaba rato sin sonar (pantalla apagada, pestaña en
  // segundo plano un buen rato), y un conductor que solo dejo la app
  // "En linea" sin volver a tocar nada nunca disparaba el desbloqueo de
  // primera vez si la oferta llegaba antes de su primer toque en esa
  // recarga. Reanudarlo en CADA toque es practicamente gratis (si ya esta
  // "running" no hace nada) y cubre ambos casos.
  window.addEventListener('pointerdown', unlockSharedAudioContext);
  window.addEventListener('touchstart', unlockSharedAudioContext, { passive: true });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockSharedAudioContext();
  });
}

// Registra push notifications reales (Web Push) para este conductor -- a diferencia del
// socket + Notification() del navegador, esto SI llega con el telefono bloqueado o la
// app cerrada, porque el backend le pega directo al endpoint push del navegador/SO.
async function registerDriverPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const { data } = await driverAxios.get('/push/vapid-public-key');
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
    await driverAxios.post('/push/subscribe', sub.toJSON());
  } catch {
    // Push not supported or denied — silent fail, el aviso por socket sigue funcionando de respaldo
  }
}

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

function getStatusFlow(t: (key: string) => string): Record<string, { next: string; label: string; color: string }> {
  return {
    assigned:  { next: 'picked_up', label: t('driverPortal.confirmPickup'),  color: 'bg-blue-500 hover:bg-blue-600'   },
    picked_up: { next: 'in_transit', label: t('driverPortal.startRolling'), color: 'bg-purple-500 hover:bg-purple-600' },
    in_transit:{ next: 'delivered',  label: t('driverPortal.markDelivered'), color: 'bg-green-500 hover:bg-green-600'  },
  };
}

const DOC_TYPES: { value: OrderDocument['type']; label: string }[] = [
  { value: 'unsigned_bol',  label: ORDER_DOCUMENT_TYPE_LABELS.unsigned_bol },
  { value: 'signed_bol',    label: ORDER_DOCUMENT_TYPE_LABELS.signed_bol },
  { value: 'lumper',        label: ORDER_DOCUMENT_TYPE_LABELS.lumper },
  { value: 'gate_pass',     label: ORDER_DOCUMENT_TYPE_LABELS.gate_pass },
  { value: 'fuel_receipt',  label: ORDER_DOCUMENT_TYPE_LABELS.fuel_receipt },
  { value: 'scale_receipt', label: ORDER_DOCUMENT_TYPE_LABELS.scale_receipt },
  { value: 'other',         label: ORDER_DOCUMENT_TYPE_LABELS.other },
];

function DriverRateCon({ orderId }: { orderId: string }) {
  const [rateCon, setRateCon] = useState<{ filename: string; uploaded_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ordersApi.getRateCon(orderId)
      .then(({ data }) => setRateCon(data))
      .catch(() => setRateCon(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleFile = async (file: File) => {
    setError('');
    if (file.size > 8 * 1024 * 1024) { setError('El archivo no puede superar 8MB'); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { data } = await ordersApi.uploadRateCon(orderId, { filename: file.name, data: base64 });
      setRateCon({ filename: data.filename, uploaded_at: data.uploaded_at });
    } catch {
      setError('Error al subir el archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-amber-500" /> Rate Confirmation
      </p>
      {rateCon ? (
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-700 rounded-lg px-2.5 py-1.5 border border-amber-100 dark:border-amber-800/30">
          <p className="text-xs text-gray-700 dark:text-slate-300 truncate">{rateCon.filename}</p>
          <label className="text-[10px] font-semibold text-amber-600 hover:text-amber-700 flex-shrink-0 cursor-pointer">
            {uploading ? '...' : 'Reemplazar'}
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 hover:border-amber-400 transition-colors text-xs font-semibold text-amber-600 dark:text-amber-400">
          {uploading ? <div className="w-3.5 h-3.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Subir Rate Confirmation (PDF, JPG, PNG)
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      )}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

function OrderDocuments({ orderId }: { orderId: string }) {
  const [docs, setDocs] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<OrderDocument['type']>('signed_bol');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ordersApi.getDocuments(orderId)
      .then(({ data }) => setDocs(data))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleFile = async (file: File) => {
    setError(''); setSent(false);
    if (file.size > 8 * 1024 * 1024) { setError('El archivo no puede superar 8MB'); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { data } = await ordersApi.uploadDocument(orderId, { type: docType, filename: file.name, data: base64 });
      setDocs(prev => [{ id: data.id, type: docType, filename: data.filename, uploaded_at: data.uploaded_at }, ...prev]);
      setSent(true);
    } catch {
      setError('Error al subir el documento');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await ordersApi.deleteDocument(orderId, docId);
      setDocs(prev => prev.filter(d => d.id !== docId));
      setSent(false);
    } catch {
      setError('Error al eliminar el documento');
    }
  };

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-indigo-500" /> Documentos
      </p>

      {!loading && docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-700 rounded-lg px-2.5 py-1.5 border border-indigo-100 dark:border-indigo-800/30">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">{ORDER_DOCUMENT_TYPE_LABELS[doc.type]}</p>
                <p className="text-xs text-gray-700 dark:text-slate-300 truncate">{doc.filename}</p>
              </div>
              <button onClick={() => handleDelete(doc.id)} className="text-[10px] font-semibold text-red-400 hover:text-red-500 flex-shrink-0">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <select value={docType} onChange={e => setDocType(e.target.value as OrderDocument['type'])}
          className="flex-1 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-white dark:bg-slate-700 px-2 py-1.5 text-gray-700 dark:text-slate-200">
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center justify-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 transition-colors text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
          {uploading ? <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Subir
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} disabled={uploading} />
        </label>
      </div>

      {sent && <p className="text-[10px] text-green-600 dark:text-green-400">Documento enviado por correo a Rate Confirmation ✓</p>}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

function OrderCard({ order, onStatusUpdate, highlighted }: { order: Order; onStatusUpdate: (id: string, status: string) => void; highlighted?: boolean }) {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const flow = getStatusFlow(t)[order.status];

  const handleUpdate = async () => {
    if (!flow) return;
    setUpdating(true);
    await onStatusUpdate(order.id, flow.next);
    setUpdating(false);
  };

  return (
    <div id={`order-${order.id}`} className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-5 space-y-4 transition-shadow ${
      highlighted ? 'border-blue-500 ring-4 ring-blue-500/30' : 'border-gray-100 dark:border-slate-700'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-gray-900 dark:text-white">{order.order_number}</span>
            <PriorityBadge priority={order.priority} />
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">${order.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{(order.distance_km * 0.621371).toFixed(1)} mi</p>
        </div>
      </div>

      {(order.customer_name || order.customer_phone) && (
        <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
          {order.customer_name && <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.customer_name}</p>}
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:text-blue-700 dark:hover:text-blue-300">
              <Phone className="w-3 h-3" /> {order.customer_phone}
            </a>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">{t('driverPortal.pickup')}</p>
            <p className="text-sm text-gray-700 dark:text-slate-300">{formatLocation(order.pickup_address, order.pickup_contact)}</p>
          </div>
        </div>
        <div className="ml-3 w-0.5 h-4 bg-gray-200 dark:bg-slate-600" />
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">{t('driverPortal.deliveryWord')}</p>
            <p className="text-sm text-gray-700 dark:text-slate-300">{formatLocation(order.delivery_address, order.delivery_contact)}</p>
          </div>
        </div>
      </div>

      {order.equipment_type && (
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2">
          <Truck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">{order.equipment_type}</span>
          {order.equipment_type === 'Reefer' && order.temperature && (
            <span className="text-xs font-medium text-indigo-500 dark:text-indigo-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full ml-auto">
              🌡️ {order.temperature}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.weight')}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{(order.weight_kg * 2.20462).toFixed(0)} lbs</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.created')}</p>
          <p className="text-xs font-medium text-gray-900 dark:text-slate-100 break-words">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.eta')}</p>
          <p className="text-xs font-medium text-gray-900 dark:text-slate-100">
            {order.estimated_delivery ? format(new Date(order.estimated_delivery), 'HH:mm') : '—'}
          </p>
        </div>
      </div>

      {order.truck_type && (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
          <Truck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('driverPortal.equipment')}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{order.truck_type}</span>
        </div>
      )}

      {order.description && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
          <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-0.5">{t('driverPortal.commodity')}</p>
          <p className="text-xs text-gray-600 dark:text-slate-400">{order.description}</p>
        </div>
      )}

      {/* Dispatcher info */}
      {(order.dispatcher_name || order.dispatcher_user_id) && (
        <div className="bg-orange-50 dark:bg-orange-900/15 border border-orange-100 dark:border-orange-800/30 rounded-xl px-4 py-3">
          <p className="text-[9px] font-bold text-orange-400 dark:text-orange-500 uppercase tracking-widest mb-2">{t('driverPortal.assignedBy')}</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
              {order.dispatcher_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'DS'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{order.dispatcher_name || t('driverPortal.dispatcherFallback')}</p>
              {order.dispatcher_code && (
                <p className="text-[11px] font-bold text-orange-500 tracking-widest mt-0.5">ID #{order.dispatcher_code}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {order.status !== 'cancelled' && <DriverRateCon orderId={order.id} />}
      {order.status !== 'cancelled' && <OrderDocuments orderId={order.id} />}

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
          <span className="font-semibold text-sm">{t('driverPortal.deliveredAt', { time: order.delivered_at ? format(new Date(order.delivered_at), 'HH:mm') : '' })}</span>
        </div>
      )}
    </div>
  );
}

const EQUIP_TYPES     = ['Dry Van', 'Reefer', 'Power Only', 'Flatbed', 'Tanker', 'Van', 'Box Truck', 'Hotshot'];
const EQUIP_WITH_DIMS = ['Van', 'Box Truck', 'Hotshot'];

function getStatusConfig(t: (key: string) => string): Record<DriverStatus, { label: string; dot: string; bg: string; text: string }> {
  return {
    available: { label: t('driverPortal.statusOnline'),     dot: 'bg-green-400',  bg: 'bg-green-50 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-400' },
    busy:      { label: t('driverPortal.statusOnDelivery'), dot: 'bg-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
    on_break:  { label: t('driverPortal.statusOnBreak'),    dot: 'bg-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    offline:   { label: t('driverPortal.statusOffline'),    dot: 'bg-gray-400',   bg: 'bg-gray-100 dark:bg-slate-700',      text: 'text-gray-500 dark:text-slate-400' },
  };
}

type Tab = 'active' | 'delivered' | 'map' | 'profile' | 'payments' | 'hub';

// Avisa cuando el driver bloqueo el permiso de notificaciones del navegador. A
// diferencia de InstallAppBanner, esto NO se puede descartar -- registerDriverPush()
// falla en silencio cuando el permiso es 'denied' (Notification.requestPermission() no
// vuelve a preguntar una vez negado), asi que sin este aviso el driver nunca se entera
// de que dejo de recibir ofertas de carga.
function NotificationBlockedBanner() {
  const { t } = useTranslation();
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | null>(
    supported ? Notification.permission : null
  );

  useEffect(() => {
    if (!supported) return;
    const check = () => setPermission(Notification.permission);
    document.addEventListener('visibilitychange', check);
    const interval = setInterval(check, 5000);
    return () => { document.removeEventListener('visibilitychange', check); clearInterval(interval); };
  }, [supported]);

  if (permission !== 'denied') return null;

  return (
    <div className="mb-3 rounded-2xl px-4 py-3.5 bg-red-500/10 border border-red-500/25 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/20 text-red-300">
        <BellOff className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{t('driverPortal.notifBlockedTitle')}</p>
        <p className="text-xs mt-0.5 text-slate-300">
          {t('driverPortal.notifBlockedDesc')}
        </p>
      </div>
    </div>
  );
}

export default function DriverPortal() {
  const { user, driverProfile, logout } = useDriverAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { lang, toggle: toggleLang } = useLanguage();
  const { t } = useTranslation();
  const driver = driverProfile as Driver | null;

  const [driverStatus, setDriverStatus] = useState<DriverStatus>((driver?.status as DriverStatus) ?? 'offline');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [deliveredToday, setDeliveredToday] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAppManifest(DRIVER_MANIFEST);
    setThemeColor(DRIVER_COLOR);
    return () => { setAppManifest(DISPATCH_MANIFEST); setThemeColor(DISPATCH_COLOR); };
  }, []);

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
  const [offerChecked, setOfferChecked] = useState(false);
  const [offerCountdown, setOfferCountdown] = useState(60);

  // ── Favorites ────────────────────────────────────────────
  interface Favorite { id: string; name: string; address: string; type: 'home' | 'work' | 'frequent' | 'other'; }
  const FAV_PRESETS = [
    { type: 'home'     as const, label: t('driverPortal.favHome'),     icon: '🏠' },
    { type: 'work'     as const, label: t('driverPortal.favWork'),     icon: '🏢' },
    { type: 'frequent' as const, label: t('driverPortal.favFrequent'), icon: '⭐' },
    { type: 'other'    as const, label: t('driverPortal.favOther'),    icon: '📍' },
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
  const [verifyMsgIsError,   setVerifyMsgIsError]   = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [profilePhone, setProfilePhone] = useState('');

  const handleSendCode = async (type: 'email' | 'phone') => {
    setSendingCode(true); setVerifyMsg('');
    try {
      if (type === 'phone' && firebaseAuth) {
        recaptchaRef.current?.clear();
        recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' });
        const digits = (profilePhone || '').replace(/\D/g, '');
        const e164 = digits.length === 10 ? '+1' + digits : '+' + digits;
        try {
          const result = await signInWithPhoneNumber(firebaseAuth, e164, recaptchaRef.current);
          setConfirmationResult(result);
          setCodeSent(true);
          setVerifyMsg(t('driverPortal.codeSentSms'));
          return;
        } catch (fbErr: unknown) {
          recaptchaRef.current?.clear(); recaptchaRef.current = null;
          const fbCode = (fbErr as { code?: string })?.code || '';
          if (!['auth/billing-not-enabled','auth/operation-not-allowed','auth/invalid-phone-number'].includes(fbCode)) throw fbErr;
        }
      }
      // Fallback: backend sends code via Textbelt SMS → email if SMS fails
      await userApi.sendVerification(type);
      setCodeSent(true);
      setVerifyMsg(type === 'phone' ? t('driverPortal.codeSentPhoneOrEmail') : t('driverPortal.codeSentEmail'));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error || (e as { message?: string })?.message || t('driverPortal.codeSendError');
      setVerifyMsg(msg);
      recaptchaRef.current?.clear(); recaptchaRef.current = null;
    } finally { setSendingCode(false); }
  };

  const handleVerifyCode = async () => {
    if (!verifying) return;
    setVerifyingCode(true); setVerifyMsg(''); setVerifyMsgIsError(false);
    try {
      if (verifying === 'phone' && confirmationResult) {
        const credential = await confirmationResult.confirm(codeInput);
        const fbToken = await credential.user.getIdToken();
        await userApi.confirmPhoneVerified(fbToken);
        setPhoneVerified(true);
      } else {
        await userApi.verifyCode(verifying, codeInput);
        if (verifying === 'email') setEmailVerified(true);
        else setPhoneVerified(true);
      }
      setVerifying(null); setCodeInput(''); setCodeSent(false); setConfirmationResult(null);
    } catch { setVerifyMsg(t('driverPortal.verifyCodeIncorrect')); setVerifyMsgIsError(true); }
    finally { setVerifyingCode(false); }
  };

  const cancelVerify = () => {
    setVerifying(null); setCodeInput(''); setCodeSent(false); setVerifyMsg(''); setVerifyMsgIsError(false);
    setConfirmationResult(null);
    recaptchaRef.current?.clear(); recaptchaRef.current = null;
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
  interface CommunityPost {
    id: string; author_name: string; author_role: string; message: string;
    created_at: string; likes_count: number; liked: boolean;
  }
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postText, setPostText] = useState('');
  const [hubSection, setHubSection] = useState<'community'|'leaderboard'|'support'|'radio'>('community');
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  const loadCommunityPosts = useCallback(() => {
    communityApi.getPosts().then(r => setCommunityPosts(r.data)).catch(() => {}).finally(() => setCommunityLoading(false));
  }, []);
  useEffect(() => { loadCommunityPosts(); }, [loadCommunityPosts]);

  const publishCommunityPost = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    try {
      const { data } = await communityApi.createPost(postText.trim());
      setCommunityPosts(prev => [data, ...prev]);
      setPostText('');
    } catch {
      alert('No se pudo publicar. Intenta de nuevo.');
    } finally {
      setPosting(false);
    }
  };

  const toggleCommunityLike = async (id: string) => {
    setCommunityPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes_count: p.liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    try { await communityApi.toggleLike(id); } catch { loadCommunityPosts(); }
  };

  interface LeaderDriver { id: string; name: string; rating: number; deliveries_30d: number; }
  interface LeaderDispatcher { id: string; name: string; loads_30d: number; earned_30d: number; }
  const [topDrivers, setTopDrivers] = useState<LeaderDriver[]>([]);
  const [topDispatchers, setTopDispatchers] = useState<LeaderDispatcher[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  useEffect(() => {
    if (hubSection !== 'leaderboard') return;
    analyticsApi.getLeaderboard()
      .then(r => { setTopDrivers(r.data.topDrivers || []); setTopDispatchers(r.data.topDispatchers || []); })
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));
  }, [hubSection]);

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
      setRateConEmail(d.rate_con_email || '');
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

  // Rate confirmation email (Company / Authority)
  const [rateConEmail, setRateConEmail] = useState('');
  const [editingRateConEmail, setEditingRateConEmail] = useState(false);
  const [savingRateConEmail, setSavingRateConEmail] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user?.driver_id) return;
    try {
      const [assignedRes, pickedRes, transitRes, delivRes] = await Promise.all([
        ordersApi.getAll({ driver_id: user.driver_id, status: 'assigned' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'picked_up' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'in_transit' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'delivered', limit: 200 }),
      ]);
      setActiveOrders([...assignedRes.data.orders, ...pickedRes.data.orders, ...transitRes.data.orders]);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const lastWeek = delivRes.data.orders.filter((o: Order) =>
        o.delivered_at && new Date(o.delivered_at) >= cutoff
      );
      setDeliveredToday(lastWeek);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.driver_id]);

  // Deep link desde el correo ("Ver orden") o desde una notificacion push: si la URL
  // trae ?order=<id>, salta al tab correcto y resalta esa orden especifica -- antes el
  // link solo abria el portal pero nunca mostraba la orden en si (el driver se quedaba
  // viendo la pantalla general sin saber cual orden era la nueva).
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const [orderNotFoundMsg, setOrderNotFoundMsg] = useState<string | null>(null);

  // Logica compartida para "llevame a esta orden especifica" -- la usan tanto
  // el deep link del correo/push (?order=<id> en la URL) como un tap directo
  // en el panel de notificaciones en la app (que antes no hacia nada al
  // tocarlo, solo marcaba como leido). Devuelve true si la encontro en algun
  // lado (activa/entregada/oferta pendiente), false si de verdad no esta.
  const jumpToOrder = useCallback((targetId: string): boolean => {
    const inActive = activeOrders.some(o => o.id === targetId);
    const inDelivered = deliveredToday.some(o => o.id === targetId);
    if (inActive || inDelivered) {
      setTab(inActive ? 'active' : 'delivered');
      setHighlightOrderId(targetId);
      setTimeout(() => {
        document.getElementById(`order-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      setTimeout(() => setHighlightOrderId(null), 6000);
      return true;
    }
    // Una oferta todavia sin aceptar no vive en activeOrders/deliveredToday --
    // vive en pendingOffer (lo llena checkActiveOffer(), que corre aparte). Si
    // coincide, el modal de oferta ya se muestra solo, no hace falta nada mas.
    if (pendingOffer?.id === targetId) return true;
    return false;
  }, [activeOrders, deliveredToday, pendingOffer]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('order');
    if (!targetId) return;

    const clearParam = () => {
      params.delete('order');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? '?' + rest : ''));
    };

    if (jumpToOrder(targetId)) { clearParam(); return; }

    // No esta en ningun lado todavia -- pero no la demos por perdida hasta que
    // checkActiveOffer() haya terminado de verdad. Un timeout fijo quedaba
    // corto en un arranque en frio (tocar la notificacion/el correo abre la
    // app desde cero: cargar el bundle entero + autenticar + pedir la oferta
    // al servidor facilmente pasa de unos segundos en datos moviles), lo que
    // disparaba un falso "ya no esta disponible" para una oferta que en
    // realidad seguia esperando respuesta.
    if (!offerChecked) return;
    setOrderNotFoundMsg(t('driverPortal.offerNotFoundDetail'));
    clearParam();
  }, [loading, jumpToOrder, offerChecked]);

  useEffect(() => {
    if (driver?.status) setDriverStatus(driver.status as DriverStatus);
  }, [driver?.status]);

  const playOfferSound = () => {
    try {
      const ctx = getSharedAudioContext();
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
      const ctx = getSharedAudioContext();
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
      const ctx = getSharedAudioContext();
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

  const fetchBilling = useCallback(() => {
    if (!driverId) return;
    return billingApi.getRecords({ driver_id: driverId, limit: 200 })
      .then(r => {
        const rows: DriverBillingRow[] = Array.isArray(r.data) ? r.data : (r.data.records ?? []);
        setBillingRows(rows.slice(0, 20));
        const total = rows.reduce((s, row) => s + row.driver_charge, 0);
        const settled = rows.filter(row => row.status === 'settled').reduce((s, row) => s + row.driver_charge, 0);
        setBillingSummary({ total_charged: total, settled, pending: total - settled });
      })
      .catch(() => {});
  }, [driverId]);

  useEffect(() => {
    fetchOrders();
    if (driverId) {
      driversApi.getFavorites(driverId)
        .then(r => setFavorites(r.data as Favorite[]))
        .catch(() => {});
      fetchBilling();
    }
    if (driverId) {
      notificationsApi.getDriverNotifs(driverId)
        .then(r => setDriverNotifs(r.data.notifications as DriverNotif[]))
        .catch(() => {});
    }

    // Si el conductor cerro la app (o se le apago el telefono, o se quedo
    // sin señal un rato) mientras tenia una oferta pendiente sin responder,
    // el evento de socket que la mostro ya paso y no se repite solo -- hay
    // que recuperarla a mano, si no la oferta "desaparece" para el conductor
    // aunque siga activa y esperando respuesta en el servidor. Se llama al
    // montar Y en cada reconexion del socket (ver subscribeAll abajo), no
    // solo una vez, para cubrir tambien el caso de "la oferta llego justo
    // durante un corte de conexion".
    const checkActiveOffer = () => {
      if (!driverId) return;
      ordersApi.getAll({ offered_to_driver_id: driverId, status: 'offered' })
        .then(r => {
          const active = (r.data.orders as Order[])[0];
          if (!active) { setOfferChecked(true); return; }
          setPendingOffer(active);
          const offeredAtMs = active.offered_at ? new Date(active.offered_at).getTime() : Date.now();
          const elapsedSecs = Math.floor((Date.now() - offeredAtMs) / 1000);
          setOfferCountdown(Math.max(0, 7200 - elapsedSecs));
          startAlarm();
          setOfferChecked(true);
        })
        .catch(() => setOfferChecked(true));
    };

    const socket = getSocket();
    // Unirse a las salas (subscribe_orders/driver:subscribe/radio:join) solo
    // pasaba UNA vez al montar -- si el socket se reconecta por cualquier
    // motivo (el backend se reinicia/redeploya, el celular pierde señal un
    // momento, Render duerme el server gratis), el servidor ve una conexion
    // nueva sin ninguna sala unida, y como nada vuelve a pedir la
    // suscripcion, el conductor deja de recibir "driver:offer" (y las demas
    // salas) para siempre hasta que recargue la app a mano -- exactamente lo
    // que paso: el redeploy del backend tiro la conexion y nunca se
    // resuscribio sola. Ahora se re-suscribe en CADA conexion, no solo la
    // primera (socket.io ya reconecta solo, esto solo le faltaba avisarle
    // al servidor de nuevo que salas le interesan) -- y de paso revisa si se
    // perdio alguna oferta durante el corte.
    const subscribeAll = () => {
      socket.emit('subscribe_orders');
      if (driverId) socket.emit('driver:subscribe', driverId);
      socket.emit('radio:join');
      checkActiveOffer();
    };
    subscribeAll();
    socket.on('connect', subscribeAll);
    if (driverId) registerDriverPush();
    socket.on('order_updated', () => fetchOrders());
    socket.on('driver:notification', (notif: DriverNotif) => {
      setDriverNotifs(prev => [notif, ...prev]);
      playNotificationPing();
    });
    socket.on('driver:offer', (offer: Order) => {
      setPendingOffer(offer);
      setOfferCountdown(7200);
      startAlarm();
      // Browser push notification -- misma info que la notificacion push
      // real (tarifa y millas ademas de la ruta), para cuando la app esta
      // abierta en primer plano y esta es la que se ve.
      if ('Notification' in window) {
        const miles = Math.round((offer.distance_km || 0) * 0.621371);
        const show = () => new Notification('🚛 Nueva oferta de carga', {
          body: `${offer.order_number} · $${Math.round(offer.price).toLocaleString('en-US')}${miles ? ' · ' + miles + ' mi' : ''}\n${formatLocation(offer.pickup_address, offer.pickup_contact)} → ${formatLocation(offer.delivery_address, offer.delivery_contact)}`,
          icon: '/favicon.ico',
          requireInteraction: true,
        });
        if (Notification.permission === 'granted') show();
        else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') show(); });
      }
    });
    socket.on('radio:msg', (data: {name:string; msg:string; ts:string}) => {
      setRadioMsgs(prev => [...prev.slice(-49), { id: Date.now().toString(), type: 'text' as const, ...data }]);
    });
    socket.on('radio:voice', (data: {name:string; audioData:string; duration:number; ts:string}) => {
      setRadioMsgs(prev => [...prev.slice(-49), { id: Date.now().toString(), type: 'voice' as const, msg: '', ...data }]);
    });
    return () => {
      socket.off('connect', subscribeAll);
      socket.off('order_updated');
      socket.off('driver:notification');
      socket.off('driver:offer');
      socket.off('radio:msg');
      socket.off('radio:voice');
    };
  }, [fetchOrders, fetchBilling, user?.driver_id, driverId]);

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
      const ctx = getSharedAudioContext();
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
      const ctx = getSharedAudioContext();
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
      const ctx = getSharedAudioContext();
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

  // No dejar cerrar sesion estando "en linea" -- si el conductor esta
  // available/busy/on_break, cerrar sesion lo saca de la app pero el
  // servidor lo sigue mostrando como si pudiera recibir ofertas, y ya vimos
  // en esta misma conversacion cuanto cuesta que una oferta le vuelva a
  // llegar si no tiene la app abierta. Se le pide primero ponerse "Offline".
  const handleLogoutClick = () => {
    if (driverStatus !== 'offline') {
      alert('Debes ponerte "Offline" antes de cerrar sesión.');
      return;
    }
    logout();
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    await ordersApi.updateStatus(orderId, { status });
    if (status === 'delivered') playDeliveredSound();
    await fetchOrders();
  };

  // ── Payment modal ─────────────────────────────────────
  type PayTab = 'card' | 'zelle' | 'ach';
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTab, setPayTab] = useState<PayTab>('card');
  const [payAmount, setPayAmount] = useState('');
  const [payProcessing, setPayProcessing] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const openPayModal = () => {
    setPayAmount(billingSummary ? billingSummary.pending.toFixed(2) : '');
    setPayTab('card');
    setPaySuccess(false);
    setShowPayModal(true);
  };

  const handlePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    setPayProcessing(true);
    try {
      const { data } = await driverAxios.post('/stripe/create-checkout', {
        amount: parseFloat(payAmount),
        description: `Comisión OSI Logistics - Driver`,
        billing_id: null,
        success_url: window.location.origin + '/driver?paid=1',
        cancel_url:  window.location.origin + '/driver',
      });
      if (data?.url) {
        setShowPayModal(false);
        window.open(data.url, '_blank');
      }
    } catch {
      alert('Error al conectar con Stripe. Intenta de nuevo.');
    } finally {
      setPayProcessing(false);
    }
  };

  const isBusy = activeOrders.some(o => ['picked_up', 'in_transit'].includes(o.status));
  const todayRevenue = deliveredToday.reduce((sum, o) => sum + o.price, 0);
  const isOsiDemo    = user?.email?.endsWith('@osilogistics.com') ?? false;
  const displayRevenue = isOsiDemo ? 8500 : todayRevenue;
  const cfg = getStatusConfig(t)[driverStatus];

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
    { label: isDotEquip ? t('driverPortal.itemCompanyDot') : t('driverPortal.itemCompanyMc'),
      done: !!(driver?.company_name && authorityNum) },
    { label: t('driverPortal.itemRateConEmail'),   done: !!rateConEmail },
    { label: t('driverPortal.itemTruckMake'),       done: !!localTruckMake },
    { label: t('driverPortal.itemEquipType'),   done: !!localEquipType },
    ...(!isDotEquip ? [
      { label: t('driverPortal.itemTruckNum'),        done: !!truckNum },
      { label: t('driverPortal.itemTrailerNum'),      done: !!trailerNum },
    ] : []),
    ...(isDotEquip ? [
      { label: t('driverPortal.itemDimensions'),        done: !!(equipLength && equipWidth) },
      { label: t('driverPortal.itemLoadCapacity'),  done: !!loadCapacity },
    ] : []),
    { label: t('driverPortal.itemCoi'),     done: !!coiFileName },
    { label: t('driverPortal.itemFactoring'),        done: !!factoringCompany },
    { label: t('driverPortal.itemPayoutMethod'),   done: !!payoutMethod },
  ];
  const profileScore = profileItems.filter(i => i.done).length;

  // ── Achievements ───────────────────────────────────────────
  const totalDel  = driver?.total_deliveries || 0;
  const onTimeRt  = driver?.on_time_rate || 0;
  const drvRating = driver?.rating || 0;
  const ACHIEVEMENTS = [
    { icon: '✅', label: t('driverPortal.achCompleteProfile'), desc: t('driverPortal.achCompleteProfileDesc'), unlocked: profileScore >= profileItems.length, current: profileScore, target: profileItems.length, showProgress: true  },
    { icon: '🚀', label: t('driverPortal.achFirstMile'),       desc: t('driverPortal.achFirstMileDesc'),       unlocked: totalDel  >= 1,   current: Math.min(totalDel, 1),    target: 1,    showProgress: false },
    { icon: '📦', label: t('driverPortal.achGettingStarted'),  desc: t('driverPortal.achGettingStartedDesc'),  unlocked: totalDel  >= 10,  current: Math.min(totalDel, 10),   target: 10,   showProgress: true  },
    { icon: '⭐', label: t('driverPortal.achRisingStar'),      desc: t('driverPortal.achRisingStarDesc'),      unlocked: totalDel  >= 25,  current: Math.min(totalDel, 25),   target: 25,   showProgress: true  },
    { icon: '💪', label: t('driverPortal.achRoadWarrior'),     desc: t('driverPortal.achRoadWarriorDesc'),     unlocked: totalDel  >= 50,  current: Math.min(totalDel, 50),   target: 50,   showProgress: true  },
    { icon: '🏆', label: t('driverPortal.achEliteDriver'),     desc: t('driverPortal.achEliteDriverDesc'),     unlocked: totalDel  >= 100, current: Math.min(totalDel, 100),  target: 100,  showProgress: true  },
    { icon: '⏰', label: t('driverPortal.achPunctualityPro'),  desc: t('driverPortal.achPunctualityProDesc'),  unlocked: onTimeRt  >= 95,  current: Math.min(onTimeRt, 95),   target: 95,   showProgress: false },
    { icon: '🌟', label: t('driverPortal.achFiveStarDriver'),  desc: t('driverPortal.achFiveStarDriverDesc'),  unlocked: drvRating >= 4.8, current: drvRating,                 target: 4.8,  showProgress: false },
  ];
  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;

  const verificationPanel = verifying && (
    <div className="mt-2 p-3 rounded-xl border border-orange-100 bg-orange-50 dark:bg-slate-700/60 dark:border-slate-600">
      <p className="text-xs font-semibold text-gray-800 dark:text-white mb-2">
        {verifying === 'email' ? t('driverPortal.verifyEmailTitle') : t('driverPortal.verifyPhoneTitle')}
      </p>
      {!codeSent ? (
        <button onClick={() => handleSendCode(verifying)} disabled={sendingCode}
          className="w-full py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {sendingCode && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
          {t('driverPortal.sendCode6Digits')}
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
            {t('driverPortal.confirmCode')}
          </button>
          {confirmationResult && verifying === 'phone' && (
            <button onClick={async () => {
              recaptchaRef.current?.clear(); recaptchaRef.current = null;
              setConfirmationResult(null); setCodeSent(false); setCodeInput(''); setVerifyMsg(''); setVerifyMsgIsError(false);
              setSendingCode(true);
              try {
                await userApi.sendVerification('phone');
                setCodeSent(true);
                setVerifyMsg(t('driverPortal.codeSentEmail'));
              } catch { setVerifyMsg(t('driverPortal.resendError')); }
              finally { setSendingCode(false); }
            }} className="text-[10px] text-gray-400 underline w-full text-center">
              {t('driverPortal.resendToEmailPrompt')}
            </button>
          )}
        </div>
      )}
      {!codeSent && verifyMsg && <p className="text-[10px] text-red-500 mt-1">{verifyMsg}</p>}
      {codeSent && verifyMsg && verifyMsgIsError && <p className="text-[10px] text-red-500 mt-1">{verifyMsg}</p>}
      <button onClick={cancelVerify} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600">{t('driverPortal.cancel')}</button>
    </div>
  );

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
              <InstallAppButton
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                iconClassName="w-4 h-4 text-slate-300"
              />
              <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
              </button>
              <button onClick={toggleLang} className="px-1.5 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-0.5">
                <Languages className="w-4 h-4 text-slate-300" />
                <span className="text-[10px] font-bold text-slate-300">{lang.toUpperCase()}</span>
              </button>
              <button onClick={() => setShowNotifs(v => !v)} className="relative p-2 rounded-xl hover:bg-white/10 transition-colors">
                <Bell className="w-4 h-4 text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={handleLogoutClick} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <LogOut className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Driver identity hero */}
        <div className="px-4 pt-2 pb-1">
          <div className="max-w-lg mx-auto">

            {/* ── Compact 3-Switch Row ──────────────────────── */}
            <div className="space-y-2 mb-1">
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
                    <p className="text-[9px] font-bold text-white leading-none">{t('driverPortal.musicLabel')}</p>
                    <p className="text-[8px] leading-none mt-0.5" style={{ color: musicOn ? '#c084fc' : '#475569' }}>
                      {musicOn ? `▶ ${t('driverPortal.musicPlaying')}` : 'Trap'}
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
        <div className="px-4 pt-3 pb-4">
          <div className="max-w-lg mx-auto">

            {orderNotFoundMsg && (
              <div className="mb-3 rounded-2xl px-4 py-3.5 bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/20 text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t('driverPortal.offerExpiredTitle')}</p>
                  <p className="text-xs mt-0.5 text-slate-300">{orderNotFoundMsg}</p>
                </div>
                <button onClick={() => setOrderNotFoundMsg(null)} className="p-1 rounded flex-shrink-0 text-slate-400 hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <NotificationBlockedBanner />
            <InstallAppBanner dismissKey="osi_install_banner_dismissed_driver" variant="dark" />

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
                ${displayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs mt-0.5 text-slate-500">{t('driverPortal.lastWeekRevenue')}</p>
            </button>
            <div className="rounded-2xl px-2 py-4 text-center bg-white/6 border border-white/10">
              <Award className="w-5 h-5 text-orange-400 mx-auto" />
              <p className="text-2xl font-bold text-orange-400 mt-0.5">{unlockedCount}<span className="text-sm text-orange-500/60 font-normal">/8</span></p>
              <p className="text-xs mt-0.5 text-slate-500">{t('driverPortal.achievements')}</p>
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
                <span className="text-sm font-bold text-white">{t('header.notifications')}</span>
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
                    <CheckCheck className="w-3.5 h-3.5" /> {t('header.markAllRead')}
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
                  <p className="text-sm text-slate-500">{t('header.noNotifications')}</p>
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
                      setShowNotifs(false);
                      if (notif.related_id && !jumpToOrder(notif.related_id)) {
                        setOrderNotFoundMsg(t('driverPortal.offerNotFoundDetail'));
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
                  <span className="text-[10px] font-bold text-red-400 tracking-[0.12em] uppercase">{t('driverPortal.statusOffline')}</span>
                </div>
              )}

              {/* Text */}
              <h3 className={`text-lg font-bold mb-1.5 tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}
                style={dark ? { textShadow: '0 1px 8px rgba(0,0,0,0.5)' } : undefined}>
                {t('driverPortal.offlineTitle')}
              </h3>
              <p className={`leading-relaxed ${dark ? 'text-slate-400 text-sm mb-4' : 'text-gray-500 text-sm mb-5'}`}>
                {t('driverPortal.offlineSubtitle')}
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
                <span>{t('driverPortal.goOnlineNow')}</span>
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
                <div className="text-center py-12 text-gray-400 dark:text-slate-500">{t('driverPortal.loadingOrders')}</div>
              ) : activeOrders.length === 0 ? (
                <div className="text-center py-16 fade-in">
                  <Package className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">{t('driverPortal.noActiveOrders')}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">{t('driverPortal.newOrdersHint')}</p>
                </div>
              ) : (
                activeOrders.map(order => (
                  <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} highlighted={order.id === highlightOrderId} />
                ))
              )}
            </div>
          )}

          {tab === 'delivered' && (
            <div className="space-y-4">

              {deliveredToday.length > 0 && (() => {
                const isDemo        = isOsiDemo;
                const grossRevenue  = displayRevenue;
                const loads         = isDemo ? 3 : deliveredToday.length;
                const driverNet     = grossRevenue * 0.93;
                const osiFee        = grossRevenue * 0.07;
                const avgPerLoad    = grossRevenue / loads;
                const bestLoad      = isDemo ? 4600 : Math.max(...deliveredToday.map(o => o.price));
                const totalMiles    = isDemo ? 2751.0 : deliveredToday.reduce((s, o) => s + (o.distance_km || 0), 0) * 0.621371;
                const ratePerMile   = isDemo ? 3.09 : (totalMiles > 0 ? grossRevenue / totalMiles : 0);
                const fmt = (n: number, dec = 2) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

                return (
                  <>
                    {/* ── Revenue Hero ───────────────────────── */}
                    <div className="rounded-2xl overflow-hidden" style={{
                      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
                      boxShadow: '0 8px 32px rgba(5,150,105,0.35), inset 0 1px 0 rgba(167,243,208,0.15)'
                    }}>
                      <div className="px-5 pt-5 pb-4">
                        <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-widest mb-1">{t('driverPortal.lastWeekRevenue')}</p>
                        <p className="text-4xl font-black text-white tracking-tight">${fmt(grossRevenue)}</p>
                        <p className="text-xs text-emerald-200/50 mt-1">{t('driverPortal.loadsCompleted', { count: loads })}</p>
                      </div>
                      <div className="grid grid-cols-2 border-t border-white/10">
                        <div className="px-5 py-3 border-r border-white/10">
                          <p className="text-[9px] text-emerald-300/50 uppercase tracking-widest mb-0.5">{t('driverPortal.yourEarnings93')}</p>
                          <p className="text-xl font-black text-emerald-300">${fmt(driverNet)}</p>
                        </div>
                        <div className="px-5 py-3">
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">{t('driverPortal.osiFee7')}</p>
                          <p className="text-xl font-bold text-white/50">${fmt(osiFee)}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Quick Stats ─────────────────────────── */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700">
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{loads}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">{t('driverPortal.loads')}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700">
                        <p className="text-base font-black text-gray-900 dark:text-white">${fmt(avgPerLoad, 2)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">{t('driverPortal.average')}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700">
                        <p className="text-base font-black text-green-600">${fmt(bestLoad, 2)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">{t('driverPortal.best')}</p>
                      </div>
                    </div>

                    {/* ── Miles & Rate ────────────────────────── */}
                    {totalMiles > 0 && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl px-5 py-4 border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{t('driverPortal.totalMiles')}</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">{totalMiles.toFixed(1)} <span className="text-sm font-normal text-gray-400">mi</span></p>
                        </div>
                        <div className="w-px h-10 bg-gray-100 dark:bg-slate-700" />
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{t('driverPortal.ratePerMile')}</p>
                          <p className="text-xl font-black text-blue-600">${ratePerMile.toFixed(2)}<span className="text-sm font-normal text-gray-400">/mi</span></p>
                        </div>
                      </div>
                    )}

                    {/* ── Section label ───────────────────────── */}
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">{t('driverPortal.loadDetail')}</p>
                  </>
                );
              })()}

              {deliveredToday.length === 0 ? (
                <div className="text-center py-16 fade-in">
                  <CheckCircle className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">{t('driverPortal.noDeliveriesToday')}</p>
                </div>
              ) : isOsiDemo ? (
                [
                  { id: 'd1', order_number: 'OSI-2024131', customer_name: 'TechCorp Solutions',      delivery_address: '401 Collins Ave, Miami Beach, FL', price: 4600, delivered_at: '2026-08-29T14:22:00' },
                  { id: 'd2', order_number: 'OSI-2024128', customer_name: 'BuildRight Construction', delivery_address: '20001 E Country Club Dr, Aventura, FL', price: 2400, delivered_at: '2026-08-27T10:45:00' },
                  { id: 'd3', order_number: 'OSI-2024125', customer_name: 'MedSupply Inc',           delivery_address: '1 Alhambra Plaza, Coral Gables, FL', price: 1500, delivered_at: '2026-08-25T09:17:00' },
                ].map(order => (
                  <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{order.delivery_address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">${order.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{format(new Date(order.delivered_at), 'MM/dd · HH:mm')}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-600">{t('driverPortal.delivered')}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                deliveredToday.map(order => (
                  <div key={order.id} id={`order-${order.id}`} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center justify-between transition-shadow ${
                    order.id === highlightOrderId ? 'border-blue-500 ring-4 ring-blue-500/30' : 'border-gray-100 dark:border-slate-700'
                  }`}>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                      {order.customer_name && <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name}</p>}
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatLocation(order.delivery_address, order.delivery_contact)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">${order.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {order.delivered_at && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">{format(new Date(order.delivered_at), 'MM/dd · HH:mm')}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-600">{t('driverPortal.delivered')}</span>
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
                      <span className="text-[10px] font-bold text-cyan-400 tracking-[0.15em] uppercase">{t('driverPortal.liveTracking')}</span>
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
                      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatLocation(activeOrders[0].pickup_address, activeOrders[0].pickup_contact))}`
                      : activeOrders.length > 0
                        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatLocation(activeOrders[0].delivery_address, activeOrders[0].delivery_contact))}`
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
                    <Navigation className="w-3 h-3" /> {t('driverPortal.activeOrder')}
                  </p>
                  {activeOrders[0].status === 'assigned' && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatLocation(activeOrders[0].pickup_address, activeOrders[0].pickup_contact))}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-between bg-white dark:bg-blue-900/30 rounded-xl px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-800/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{t('driverPortal.goToPickup')}</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[200px]">{formatLocation(activeOrders[0].pickup_address, activeOrders[0].pickup_contact)}</p>
                        </div>
                      </div>
                      <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </a>
                  )}
                  {['picked_up','in_transit'].includes(activeOrders[0].status) && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatLocation(activeOrders[0].delivery_address, activeOrders[0].delivery_contact))}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center justify-between bg-white dark:bg-blue-900/30 rounded-xl px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-800/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{t('driverPortal.goToDelivery')}</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[200px]">{formatLocation(activeOrders[0].delivery_address, activeOrders[0].delivery_contact)}</p>
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
                        className="text-[9px] font-bold text-orange-500 hover:text-orange-600 flex-shrink-0">{t('driverPortal.verify')}</button>
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
                        className="text-[9px] font-bold text-orange-500 hover:text-orange-600 flex-shrink-0">{t('driverPortal.verify')}</button>
                  }
                </div>
                {/* Verification panel (shared by email/phone) */}
                {verifying && verificationPanel}
              </div>
            </div>

            {/* ── Stats grid ── */}
            <div className="border-t border-gray-100 dark:border-slate-700 mx-4 mb-1" />
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                { label: t('driverPortal.statTotalDeliveries'), value: driver.total_deliveries,                icon: Package,   color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { label: t('driverPortal.statOnTimeRate'),     value: `${driver.on_time_rate.toFixed(0)}%`,   icon: Clock,     color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-500/10' },
                { label: t('driverPortal.statLicenseNumber'),  value: driver.license_number,                  icon: FileText,  color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                { label: t('driverPortal.statRating'),         value: `★ ${driver.rating.toFixed(1)}`,        icon: Star,      color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10' },
                { label: t('driverPortal.statLicExpiry'),      value: driver.license_expiry || '—',           icon: Calendar,  color: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-500/10' },
                { label: t('driverPortal.statHireDate'),       value: driver.hire_date || '—',                icon: Briefcase, color: 'text-teal-500',   bg: 'bg-teal-50 dark:bg-teal-500/10' },
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
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{t('driverPortal.completeProfile')}</p>
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.companyAuthority')}</h3>
            </div>
            <div className="space-y-2.5">
              {driver.company_name && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.companyName')}</span>
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
                  <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {t('driverPortal.authorityTime')}</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">{calcAuthority(driver.authority_since)}</span>
                </div>
              )}

              {/* Rate Confirmation Email */}
              <div className="pt-1 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {t('driverPortal.rateConEmail')}</span>
                  {!editingRateConEmail && (
                    <button onClick={() => setEditingRateConEmail(true)}
                      className="text-[9px] font-bold text-orange-500 hover:text-orange-600 flex-shrink-0">
                      {rateConEmail ? t('driverPortal.edit') : t('driverPortal.add')}
                    </button>
                  )}
                </div>
                {!editingRateConEmail ? (
                  <span className={`text-sm font-medium ${rateConEmail ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {rateConEmail || t('driverPortal.notSet')}
                  </span>
                ) : (
                  <div className="space-y-2 mt-1">
                    <input type="email" className="input text-sm w-full" value={rateConEmail}
                      onChange={e => setRateConEmail(e.target.value)}
                      placeholder="dispatch@tuempresa.com" />
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{t('driverPortal.rateConEmailHint')}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingRateConEmail(false); setRateConEmail(driverExtra?.rate_con_email || ''); }}
                        className="flex-1 text-xs py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500">
                        {t('driverPortal.cancel')}
                      </button>
                      <button
                        disabled={savingRateConEmail}
                        onClick={async () => {
                          if (!driverId) return;
                          setSavingRateConEmail(true);
                          try {
                            await driversApi.update(driverId, { rate_con_email: rateConEmail });
                            setEditingRateConEmail(false);
                          } catch {} finally { setSavingRateConEmail(false); }
                        }}
                        className="flex-1 text-xs py-1.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1">
                        {savingRateConEmail ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {t('driverPortal.save')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── My Equipment (editable) ───────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.myEquipment')}</h3>
              </div>
              {!editingEquip ? (
                <button onClick={() => setEditingEquip(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> {t('driverPortal.edit')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingEquip(false)}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                    {t('driverPortal.cancel')}
                  </button>
                  <button onClick={saveEquipment} disabled={savingEquip}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50">
                    {savingEquip && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                    {t('driverPortal.save')}
                  </button>
                </div>
              )}
            </div>

            {!editingEquip ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.truck')}</span>
                  <span className={`text-sm font-semibold ${localTruckMake ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {localTruckMake || t('driverPortal.notSet')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.trailerEquipment')}</span>
                  <span className={`text-sm font-semibold ${localEquipType ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                    {localEquipType || t('driverPortal.notSet')}
                  </span>
                </div>
                {!EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.truckNumber')}</span>
                      <span className={`text-sm font-mono font-semibold ${truckNum ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {truckNum || t('driverPortal.notSet')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.trailerNumber')}</span>
                      <span className={`text-sm font-mono font-semibold ${trailerNum ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {trailerNum || t('driverPortal.notSet')}
                      </span>
                    </div>
                  </>
                )}
                {EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.lengthFt')}</span>
                      <span className={`text-sm font-semibold ${equipLength ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {equipLength || t('driverPortal.notSet')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.widthFt')}</span>
                      <span className={`text-sm font-semibold ${equipWidth ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {equipWidth || t('driverPortal.notSet')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.loadCapacityLbs')}</span>
                      <span className={`text-sm font-semibold ${loadCapacity ? 'text-gray-800 dark:text-slate-200' : 'text-gray-300 dark:text-slate-600 italic'}`}>
                        {loadCapacity ? `${Number(loadCapacity).toLocaleString()} lbs` : t('driverPortal.notSet')}
                      </span>
                    </div>
                  </>
                )}
                {!localTruckMake && !truckNum && !trailerNum && (
                  <button onClick={() => setEditingEquip(true)}
                    className="w-full mt-1 py-2.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                    {t('driverPortal.addEquipmentInfo')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">{t('driverPortal.truckMakeModel')}</label>
                  <input type="text" placeholder="e.g. Volvo 860, Kenworth T680"
                    value={localTruckMake} onChange={e => setLocalTruckMake(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 border-0 outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">{t('driverPortal.trailerEquipmentType')}</label>
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
                      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">{t('driverPortal.truckNumber')}</label>
                      <input type="text" placeholder="e.g. 9809" value={truckNum} onChange={e => setTruckNum(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">{t('driverPortal.trailerNumber')}</label>
                      <input type="text" placeholder="e.g. T4126" value={trailerNum} onChange={e => setTrailerNum(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                    </div>
                  </>
                )}
                {EQUIP_WITH_DIMS.includes(localEquipType) && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">{t('driverPortal.dimensionsFt')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 block">{t('driverPortal.length')}</label>
                          <input type="number" placeholder="ej. 16" value={equipLength} onChange={e => setEquipLength(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 block">{t('driverPortal.width')}</label>
                          <input type="number" placeholder="ej. 8" value={equipWidth} onChange={e => setEquipWidth(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">{t('driverPortal.loadCapacityLbs')}</label>
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.myTruck')}</h3>
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
            const statusLabel = isExpired ? t('driverPortal.expiredDays', { days: Math.abs(daysLeft!) }) : isExpiringSoon ? t('driverPortal.expiresInDays', { days: daysLeft }) : coiExpiry ? t('driverPortal.coiValid') : coiFileName ? t('driverPortal.coiNoExpiry') : t('driverPortal.coiNotUploaded');
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.coiTitle')}</h3>
                  </div>
                  <button onClick={() => setCoiEditing(v => !v)}
                    className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> {coiEditing ? t('driverPortal.close') : t('driverPortal.edit')}
                  </button>
                </div>

                {/* Status row */}
                <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" style={{ color: statusColor }} />
                    <span className="text-sm text-gray-700 dark:text-slate-300 truncate max-w-[160px]">
                      {coiFileName || t('driverPortal.noFile')}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}18`, color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                {coiExpiry && !coiEditing && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-slate-400">{t('driverPortal.expiry')}</span>
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
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5">{t('driverPortal.fileLabel')}</p>
                      <label className="flex items-center gap-2 cursor-pointer min-w-0">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 transition-colors flex-1 min-w-0 overflow-hidden">
                          <Upload className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500 dark:text-slate-400 truncate min-w-0">
                            {coiFileName || t('driverPortal.selectFile')}
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
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('driverPortal.expiryDate')}</p>
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
                        {t('driverPortal.deleteCoi')}
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
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.factoring')}</h3>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">{t('driverPortal.factoringSubtitle')}</p>
                </div>
              </div>
              <button onClick={() => setEditingFactoring(v => !v)}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                <Edit3 className="w-3 h-3" /> {editingFactoring ? t('driverPortal.close') : t('driverPortal.edit')}
              </button>
            </div>

            {/* NOA badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${factoringNoa ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {factoringNoa ? t('driverPortal.noaActive') : t('driverPortal.noNoa')}
              </span>
              {factoringCompany && (
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{factoringCompany}</span>
              )}
            </div>

            {!factoringCompany && !editingFactoring && (
              <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.noFactoringInfo')}</p>
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
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('driverPortal.factoringCompany')}</p>
                  <input className="input text-sm w-full" value={factoringCompany}
                    onChange={e => setFactoringCompany(e.target.value)}
                    placeholder="Ej: OTR Solutions, RTS Financial..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('driverPortal.phone')}</p>
                    <input className="input text-sm w-full" value={factoringPhone}
                      onChange={e => setFactoringPhone(e.target.value)}
                      placeholder="(800) 000-0000" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('driverPortal.email')}</p>
                    <input className="input text-sm w-full" value={factoringEmail}
                      onChange={e => setFactoringEmail(e.target.value)}
                      placeholder="noa@factor.com" />
                  </div>
                </div>
                {/* NOA toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 dark:bg-slate-700/50">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{t('driverPortal.noaLabel')}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{t('driverPortal.noaHint')}</p>
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
                    {t('driverPortal.cancel')}
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
                    {t('driverPortal.save')}
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
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.myPaymentsToOsi')}</p>
                {billingSummary && billingSummary.pending > 0 ? (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    {t('driverPortal.pendingAmount', { amount: `$${billingSummary.pending.toFixed(2)}` })}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.viewPaymentHistory')}</p>
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.favoritePlaces')}</h3>
              </div>
              {favorites.length < 5 && !showAddFav && (
                <button onClick={() => setShowAddFav(true)}
                  className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> {t('driverPortal.add')}
                </button>
              )}
            </div>

            {favorites.length === 0 && !showAddFav && (
              <div className="text-center py-4">
                <MapPin className="w-8 h-8 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.noSavedPlaces')}</p>
                <button onClick={() => setShowAddFav(true)}
                  className="mt-2 text-xs text-orange-500 hover:text-orange-600 font-medium">
                  {t('driverPortal.addPlace')}
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
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{t('driverPortal.newPlace')}</p>
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
                  placeholder={t('driverPortal.placeName')}
                  value={newFav.name}
                  onChange={e => setNewFav(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
                <input
                  type="text"
                  placeholder={t('driverPortal.address')}
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
                    {t('driverPortal.cancel')}
                  </button>
                  <button onClick={addFavorite} disabled={!newFav.name.trim() || !newFav.address.trim() || savingFav}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                    {savingFav
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Plus className="w-4 h-4" /> {t('driverPortal.save')}</>
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
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.achievements')}</h3>
                </div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  {unlockedCount} / {ACHIEVEMENTS.length}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.achievementsSubtitle')}</p>
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
                          {t('driverPortal.unlocked')}
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
              <p className={`text-base font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{t('driverPortal.pendingBalance')}</p>
              <p className={`text-3xl font-bold ${dark ? 'text-yellow-400' : 'text-orange-500'}`}>${billingSummary.pending.toFixed(2)}</p>
              <p className={`text-xs mt-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t('driverPortal.osiTakesOnly')} <span className={`font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>7%</span></p>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={dark ? 'text-slate-400' : 'text-slate-500'}>{t('driverPortal.paymentProgress')}</span>
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
                  <span className={dark ? 'text-slate-500' : 'text-slate-400'}>{t('driverPortal.paid')}: <span className="text-green-500 font-semibold">${billingSummary.settled.toFixed(2)}</span></span>
                  <span className={dark ? 'text-slate-500' : 'text-slate-400'}>{t('driverPortal.total')}: <span className={`font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>${billingSummary.total_charged.toFixed(2)}</span></span>
                </div>
              </div>
              {billingSummary.pending > 0 && (
                <button
                  onClick={openPayModal}
                  className="mt-4 w-full bg-green-500 hover:bg-green-400 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                >
                  <CreditCard className="w-4 h-4" /> {t('driverPortal.makePayment')}
                </button>
              )}
              {billingSummary.pending === 0 && billingSummary.total_charged > 0 && (
                <div className="mt-4 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl py-2.5">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">{t('driverPortal.upToDateWithOsi')}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Método de Pago ───────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('driverPortal.paymentMethod')}</h3>
              </div>
              {!editingPayout ? (
                <button onClick={() => setEditingPayout(true)}
                  className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold hover:text-green-700 dark:hover:text-green-300 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> {payoutMethod ? t('driverPortal.edit') : t('driverPortal.setUp')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingPayout(false)}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                    {t('driverPortal.cancel')}
                  </button>
                  <button onClick={savePayout} disabled={savingPayout}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50">
                    {savingPayout && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                    {t('driverPortal.save')}
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
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('driverPortal.noPayoutMethodSet')}</p>
                  <button onClick={() => setEditingPayout(true)}
                    className="mt-2.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors">
                    {t('driverPortal.setUpNow')}
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
                  <input type="text" placeholder={t('driverPortal.zellePlaceholder')}
                    value={payoutDetails.contact || ''} onChange={e => updatePayoutDetail('contact', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
                {payoutMethod === 'paypal' && (
                  <input type="email" placeholder={t('driverPortal.paypalPlaceholder')}
                    value={payoutDetails.email || ''} onChange={e => updatePayoutDetail('email', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
                {payoutMethod === 'venmo' && (
                  <input type="text" placeholder={t('driverPortal.venmoPlaceholder')}
                    value={payoutDetails.username || ''} onChange={e => updatePayoutDetail('username', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
                {payoutMethod === 'ach' && (
                  <div className="space-y-2">
                    <input type="text" placeholder={t('driverPortal.bankNamePlaceholder')}
                      value={payoutDetails.bank || ''} onChange={e => updatePayoutDetail('bank', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                    <input type="text" placeholder={t('driverPortal.accountNumberPlaceholder')}
                      value={payoutDetails.account || ''} onChange={e => updatePayoutDetail('account', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                    <input type="text" placeholder={t('driverPortal.routingNumberPlaceholder')}
                      value={payoutDetails.routing || ''} onChange={e => updatePayoutDetail('routing', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                  </div>
                )}
                {payoutMethod === 'check' && (
                  <input type="text" placeholder={t('driverPortal.checkPayableToPlaceholder')}
                    value={payoutDetails.payable_to || ''} onChange={e => updatePayoutDetail('payable_to', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/40" />
                )}
              </div>
            )}
          </div>

          {/* Records */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-1 mb-2">{t('driverPortal.paymentHistory')}</p>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              {billingRows.length === 0 ? (
                <div className="py-10 text-center">
                  <Wallet className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">{t('driverPortal.allCaughtUp')}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('driverPortal.chargesAppearHint')}</p>
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
                            ${r.order_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('driverPortal.ratePercent')} <span className="font-semibold text-gray-600 dark:text-slate-300">${r.driver_charge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        r.status === 'settled'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        {r.status === 'settled' ? t('driverPortal.paidStatus') : t('driverPortal.pendingStatus')}
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t('driverPortal.paymentSentTitle')}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-green-600">${parseFloat(payAmount || '0').toFixed(2)}</span> {t('driverPortal.processedSuccessfully')}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-6">
                  {payTab === 'card' ? t('driverPortal.balanceUpToDate') : t('driverPortal.osiWillReceiveConfirmation')}
                </p>
                <button
                  onClick={() => setShowPayModal(false)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl transition-colors"
                >
                  {t('driverPortal.close')}
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('driverPortal.makePaymentToOsi')}</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t('driverPortal.selectMethodAndAmount')}</p>
                  </div>
                  <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Amount input */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{t('driverPortal.amountToPay')}</label>
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
                        {t('driverPortal.pendingBalanceColon')} <span className="font-semibold text-yellow-500">${billingSummary.pending.toFixed(2)}</span>
                      </p>
                    )}
                  </div>

                  {/* Method tabs */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{t('driverPortal.paymentMethod')}</label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      {([
                        { id: 'card',  label: t('driverPortal.cardLabel') },
                        { id: 'zelle', label: t('driverPortal.zelleLabel') },
                        { id: 'ach',   label: t('driverPortal.achLabel') },
                      ] as { id: PayTab; label: string }[]).map(m => (
                        <button
                          key={m.id}
                          onClick={() => setPayTab(m.id)}
                          className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                            payTab === m.id
                              ? 'bg-slate-900 dark:bg-slate-700 text-white'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card — Stripe Elements (embedded card form) */}
                  {payTab === 'card' && (
                    <StripeCardPayment
                      amount={parseFloat(payAmount || '0')}
                      onSuccess={() => {
                        // El cobro con tarjeta es instantaneo (a diferencia de Zelle/ACH,
                        // que requieren confirmacion manual) -- liquida el balance del
                        // driver de una vez y refresca la pantalla para que el "Balance
                        // pendiente" baje a $0 sin que el conductor tenga que recargar.
                        if (driverId) billingApi.settleAll(driverId).catch(() => {}).finally(() => fetchBilling());
                        playSuccessChime();
                        setPaySuccess(true);
                      }}
                      onCancel={() => setShowPayModal(false)}
                    />
                  )}

                  {/* Zelle */}
                  {payTab === 'zelle' && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/40 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                        <Send className="w-4 h-4" /> {t('driverPortal.sendViaZelle')}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">{t('driverPortal.sendExactAmountTo')}</p>
                      <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">{t('driverPortal.email')}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">admin@osilogistics.com</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">{t('driverPortal.payableTo')}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">OSI Logistics Inc.</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-purple-500 dark:text-purple-400">{t('driverPortal.zelleMemoHint')}</p>
                    </div>
                  )}

                  {/* ACH */}
                  {payTab === 'ach' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        {t('driverPortal.achWireTransfer')}
                      </p>
                      <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">{t('driverPortal.bank')}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">Chase</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">Routing #</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">267084131</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">{t('driverPortal.accountNum')}</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">••••••1105</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-slate-400">{t('driverPortal.beneficiary')}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">OSI Logistics Inc.</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-blue-500 dark:text-blue-400">{t('driverPortal.achMemoHint')}</p>
                    </div>
                  )}


                  {/* Action buttons — only for Zelle / ACH tabs */}
                  {payTab !== 'card' && (
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setShowPayModal(false)}
                        className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        {t('driverPortal.cancel')}
                      </button>
                      <button
                        onClick={() => setShowPayModal(false)}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> {t('driverPortal.understood')}
                      </button>
                    </div>
                  )}
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
              { id: 'community' as const,   icon: Users,     label: t('hub.tabCommunity') },
              { id: 'leaderboard' as const, icon: Trophy,    label: t('hub.tabTop') },
              { id: 'support'   as const,   icon: PhoneCall, label: t('hub.tabSupport') },
              { id: 'radio'     as const,   icon: Radio,     label: t('driverPortal.tabRadio') },
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
                      placeholder={t('hub.composerPlaceholder')}
                      className="w-full text-sm bg-gray-50 dark:bg-slate-700 rounded-xl p-3 resize-none border-0 outline-none text-gray-800 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      rows={2}
                      maxLength={280}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-gray-300 dark:text-slate-600">{postText.length}/280</span>
                      <button
                        onClick={publishCommunityPost}
                        disabled={!postText.trim() || posting}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-400 active:scale-95 disabled:opacity-40 text-white transition-all">
                        {posting ? t('hub.publishing') : t('hub.publish')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Posts feed */}
              {communityLoading ? (
                <div className="text-center py-10 text-sm text-gray-400 dark:text-slate-500">{t('hub.loading')}</div>
              ) : communityPosts.length === 0 ? (
                <div className="text-center py-10 fade-in">
                  <Users className="w-10 h-10 text-gray-200 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">{t('hub.emptyFeed')}</p>
                </div>
              ) : communityPosts.map(post => (
                <div key={post.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm fade-in">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                      {post.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{post.author_name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })} · {t('hub.osiTeam')}</p>
                    </div>
                    <span className="text-[10px] font-bold text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-full flex-shrink-0 capitalize">
                      {post.author_role === 'driver' ? t('hub.roleDriver') : post.author_role === 'admin' ? t('hub.roleAdmin') : t('hub.roleDispatcher')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed mb-3">{post.message}</p>
                  <div className="flex items-center gap-4 pt-2.5 border-t border-gray-50 dark:border-slate-700/60">
                    <button
                      onClick={() => toggleCommunityLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${post.liked ? 'text-red-500' : 'text-gray-400 dark:text-slate-500 hover:text-red-400'}`}>
                      <Heart className="w-3.5 h-3.5" style={{ fill: post.liked ? 'currentColor' : 'none' }} />
                      {post.likes_count}
                    </button>
                    <span className="flex items-center gap-1.5 text-xs text-gray-300 dark:text-slate-600">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t('hub.osiFleet')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── LEADERBOARD ────────────────────────────── */}
          {hubSection === 'leaderboard' && (
            <div className="px-4 pb-5 space-y-3 fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-gray-500 dark:text-slate-400">
                  <Package className="w-3.5 h-3.5 text-orange-500" /> {t('hub.topDrivers30')}
                </p>
                {leaderboardLoading ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.loading')}</p>
                ) : topDrivers.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.noDataYet')}</p>
                ) : (
                  <div className="space-y-2">
                    {topDrivers.map((d, i) => (
                      <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900/50">
                        <span className="w-6 text-center font-bold text-sm" style={{ color: i === 0 ? '#eab308' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#f97316' }}>#{i + 1}</span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-orange-600 bg-orange-50 dark:bg-orange-500/10 flex-shrink-0">
                          {d.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-gray-800 dark:text-slate-200">{d.name}{d.id === driver?.id ? t('driverPortal.youSuffix') : ''}</p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500">★ {d.rating?.toFixed(1) ?? '—'}</p>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{d.deliveries_30d}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-gray-500 dark:text-slate-400">
                  <DollarSign className="w-3.5 h-3.5 text-orange-500" /> {t('hub.topDispatchers30')}
                </p>
                {leaderboardLoading ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.loading')}</p>
                ) : topDispatchers.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.noDataYet')}</p>
                ) : (
                  <div className="space-y-2">
                    {topDispatchers.map((d, i) => (
                      <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900/50">
                        <span className="w-6 text-center font-bold text-sm" style={{ color: i === 0 ? '#eab308' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#f97316' }}>#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-gray-800 dark:text-slate-200">{d.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500">{d.loads_30d} {t('hub.deliveriesWord')}</p>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">${d.earned_30d.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                      <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">{t('driverPortal.currentDispatcher')}</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">{activeOrders[0].dispatcher_name}</p>
                    </div>
                  </div>
                  {activeOrders[0].dispatcher_code && (
                    <div className="flex items-center justify-between mb-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl px-3 py-2.5">
                      <span className="text-xs text-blue-400">{t('driverPortal.dispatcherCode')}</span>
                      <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-300">{activeOrders[0].dispatcher_code}</span>
                    </div>
                  )}
                  <a href="tel:+17863334444"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-colors"
                    style={{ background: 'linear-gradient(90deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                    <PhoneCall className="w-4 h-4" /> {t('driverPortal.callDispatcher')}
                  </a>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center shadow-sm">
                  <Briefcase className="w-8 h-8 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-400 dark:text-slate-500">{t('driverPortal.noActiveLoad')}</p>
                  <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">{t('driverPortal.dispatcherAppearsHint')}</p>
                </div>
              )}

              {/* OSI Contact Lines */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                    <PhoneCall className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{t('driverPortal.osiContacts')}</p>
                </div>
                <div className="space-y-2.5">
                  {([
                    { label: t('driverPortal.dispatch247'),    phone: '+1 (904) 945-1816', desc: t('driverPortal.dispatch247Desc') },
                    { label: t('driverPortal.driverSupport'),  phone: '+1 (904) 610-3125', desc: t('driverPortal.driverSupportDesc') },
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
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">{t('driverPortal.resources')}</p>
                <div className="space-y-2">
                  {([
                    { label: t('driverPortal.driverManual'),   icon: '📋', desc: t('driverPortal.driverManualDesc'), action: undefined },
                    { label: t('driverPortal.reportIncident'),       icon: '⚠️', desc: t('driverPortal.reportIncidentDesc'), action: () => setShowIncidentModal(true) },
                    { label: t('driverPortal.requestRateAdjustment'), icon: '💰', desc: t('driverPortal.requestRateAdjustmentDesc'), action: undefined },
                  ]).map(r => (
                    <button key={r.label} onClick={r.action} disabled={!r.action}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 transition-colors text-left ${r.action ? 'hover:bg-orange-50 dark:hover:bg-orange-500/8' : 'opacity-70 cursor-default'}`}>
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
                    <p className="text-sm font-bold text-white">{t('driverPortal.osiRadio')}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-[11px] text-green-400">{t('driverPortal.onlineChannel')}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">{t('driverPortal.live')}</span>
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
                        <span className="text-[11px] font-bold text-red-400 tracking-widest uppercase">{t('driverPortal.transmitting')}</span>
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
                                const ctx = getSharedAudioContext();
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
                                  const ctx = getSharedAudioContext();
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
                              {isRecording ? t('driverPortal.transmittingShort') : t('driverPortal.pushToTalk')}
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
                              {t('driverPortal.tapToStop')}
                            </span>
                          ) : (
                            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(251,146,60,0.75)', textTransform: 'uppercase', fontFamily: 'Arial' }}>
                              {t('driverPortal.tapToRecord')}
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
                    <p className="text-[9px] text-slate-500 tracking-wider uppercase">{t('driverPortal.secureChannel')}</p>
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
                      placeholder={t('driverPortal.textToChannel')}
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
          { id: 'active',    icon: Activity,    label: t('driverNav.active'),  badge: activeOrders.length },
          { id: 'delivered', icon: CheckCircle, label: t('driverNav.done'),    badge: deliveredToday.length },
          { id: 'map',       icon: Navigation,  label: t('driverNav.map'),     badge: 0 },
          { id: 'hub',       icon: Users,       label: t('driverNav.hub'),     badge: 0 },
          { id: 'payments',  icon: Wallet,      label: t('driverNav.payments'),   badge: (billingSummary?.pending ?? 0) > 0 ? 1 : 0 },
          { id: 'profile',   icon: User,        label: t('driverNav.profile'),  badge: 0 },
        ] as const).map(({ id, icon: Icon, label, badge }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative ${
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-blue-500 rounded-full" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
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
                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest">{t('driverPortal.newOffer')}</p>
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
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">${pendingOffer.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">{t('driverPortal.pickup')}</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 leading-snug">{formatLocation(pendingOffer.pickup_address, pendingOffer.pickup_contact)}</p>
                </div>
              </div>

              {/* Delivery */}
              <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">{t('driverPortal.deliveryWord')}</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 leading-snug">{formatLocation(pendingOffer.delivery_address, pendingOffer.delivery_contact)}</p>
                </div>
              </div>

              {/* Equipment */}
              {pendingOffer.equipment_type && (
                <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3">
                  <Truck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">{pendingOffer.equipment_type}</span>
                  {pendingOffer.equipment_type === 'Reefer' && pendingOffer.temperature && (
                    <span className="text-xs font-medium text-indigo-500 dark:text-indigo-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full ml-auto">
                      🌡️ {pendingOffer.temperature}
                    </span>
                  )}
                </div>
              )}

              {/* Customer + description */}
              {(pendingOffer.customer_name || pendingOffer.description) && (
                <div className="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-slate-400">
                  {pendingOffer.customer_name && (
                    <>
                      <User className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{pendingOffer.customer_name}</span>
                    </>
                  )}
                  {pendingOffer.description && (
                    <>
                      {pendingOffer.customer_name && <span className="text-gray-300 dark:text-slate-600">·</span>}
                      <Package className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{pendingOffer.description}</span>
                    </>
                  )}
                </div>
              )}

              {/* Dispatcher contact */}
              {(pendingOffer.dispatcher_name || pendingOffer.dispatcher_phone || pendingOffer.dispatcher_email) && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mb-2">{t('driverPortal.dispatcherLabel')}</p>
                  {pendingOffer.dispatcher_name && (
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-2">{pendingOffer.dispatcher_name}</p>
                  )}
                  <div className="flex gap-2">
                    {pendingOffer.dispatcher_phone && (
                      <a
                        href={`tel:${pendingOffer.dispatcher_phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500 text-white text-xs font-semibold"
                      >
                        <Phone className="w-3.5 h-3.5" /> {t('driverPortal.call')}
                      </a>
                    )}
                    {pendingOffer.dispatcher_phone && (
                      <a
                        href={`sms:${pendingOffer.dispatcher_phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> {t('driverPortal.message')}
                      </a>
                    )}
                    {pendingOffer.dispatcher_email && (
                      <a
                        href={`mailto:${pendingOffer.dispatcher_email}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold"
                      >
                        <Mail className="w-3.5 h-3.5" /> {t('driverPortal.emailWord')}
                      </a>
                    )}
                  </div>
                </div>
              )}

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
                  <X className="w-4 h-4" /> {t('driverPortal.ignore')}
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
                  <CheckCircle className="w-4 h-4" /> {t('driverPortal.accept')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIncidentModal && <IncidentReportModal onClose={() => setShowIncidentModal(false)} createIncident={incidentsApi.create} />}

      <AiAssistantPanel
        chat={assistantApi.chat}
        title={t('driverPortal.assistantTitle')}
        greeting={t('driverPortal.assistantGreeting')}
        buttonClassName="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        accent="blue"
      />

      <div id="recaptcha-container" />
    </div>
  );
}
