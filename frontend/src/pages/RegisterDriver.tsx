import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Truck, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, User, Phone, Mail, Lock, Building2, Calendar, Hash, Clock, Send, DollarSign, KeyRound, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import osiLogo from '../assets/osi-logo.jpeg';
import driverHero from '../assets/driver-hero.jpg';

const EQUIPMENT_TYPES = ['Dry Van', 'Reefer', 'Power Only', 'Flatbed', 'Tanker', 'Van', 'Box Truck', 'Hotshot'];
const DOT_TYPES = ['Van', 'Box Truck', 'Hotshot'];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

// Whether an empty <input type="date"> shows a native "mm/dd/yyyy" hint
// varies by browser/OS/theme -- some render nothing (looks like a blank
// unlabeled box), others render it in a light color that, in dark mode,
// sits directly behind our own overlay hint below and visually overlaps
// into illegible double text. The `date-empty` class (toggled by the same
// `!value` check that shows our overlay) makes the native placeholder
// transparent only while empty, so exactly one hint is ever visible --
// ours -- regardless of what a given browser would have shown on its own.
function DateField({ value, onChange, required, placeholder }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; placeholder: string;
}) {
  return (
    <div className="relative">
      <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
      <input className={`input pl-9 ${!value ? 'date-empty' : ''}`} type="date" value={value} onChange={onChange} required={required} />
      {!value && (
        <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[calc(100%-2.75rem)]">
          {placeholder}
        </span>
      )}
    </div>
  );
}

export default function RegisterDriver() {
  const { t } = useTranslation();
  const [registered, setRegistered] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', confirm: '',
    license_number: '', license_expiry: '',
    equipment_type: '', mc_number: '', dot_number: '', company_name: '', authority_since: '',
    rate_con_email: '',
  });
  // Equipment picked first drives everything below: DOT_TYPES (Van, Box
  // Truck, Hotshot) are commonly run under 26,001 lbs GVWR/GCWR, so they
  // don't require a CDL -- a regular driver's license is enough -- and in
  // practice they register under a DOT# rather than an MC#. The other five
  // (Dry Van, Reefer, Power Only, Flatbed, Tanker) are tractor-trailer
  // combinations well over that threshold and always require a CDL.
  const requiresCdl = form.equipment_type !== '' && !DOT_TYPES.includes(form.equipment_type);
  const [authorityType, setAuthorityType] = useState<'MC#' | 'DOT#'>('MC#');
  const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(f => ({ ...f, equipment_type: value }));
    setAuthorityType(DOT_TYPES.includes(value) ? 'DOT#' : 'MC#');
  };
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [declared, setDeclared] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError(t('registerDispatcher.errorPasswordMismatch')); return; }
    if (form.password.length < 8) { setError(t('registerDispatcher.errorPasswordTooShort')); return; }
    setLoading(true);
    try {
      await api.post('/auth/register-driver', {
        name:           form.name,
        email:          form.email,
        password:       form.password,
        phone:          form.phone,
        license_number: form.license_number,
        license_expiry: form.license_expiry,
        equipment_type: form.equipment_type,
        mc_number:      form.mc_number,
        dot_number:     form.dot_number,
        company_name:   form.company_name,
        authority_since: form.authority_since,
        rate_con_email: form.rate_con_email,
      });
      setRegisteredName(form.name);
      setRegistered(true);
      (window as any).fbq?.('track', 'CompleteRegistration', { content_name: 'driver_registration' });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('registerDispatcher.errorRegistrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('registerDispatcher.successTitle')}</h1>
          <p className="text-gray-500 text-sm mb-1">{t('registerDispatcher.successGreetingPrefix')} <span className="font-semibold text-gray-800">{registeredName}</span></p>
          <p className="text-gray-500 text-sm mb-6">
            {t('registerDriver.successBody')}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 flex items-start gap-3 text-left">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">{t('registerDispatcher.pendingApprovalLabel')}</span> {t('registerDispatcher.pendingApprovalBody')}
            </p>
          </div>
          <Link to="/driver/login"
            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-2xl transition-colors text-sm">
            {t('registerDispatcher.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-lg">

        <Link to="/driver/login" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {t('registerDispatcher.backToLogin')}
        </Link>

        {/* Header */}
        <div className="text-center mb-7">
          <a href="https://osilogistics.com" target="_blank" rel="noopener noreferrer" className="inline-block mb-4">
            <img src={osiLogo} alt="OSI Logistics" className="h-[60px] w-auto object-contain mx-auto rounded-xl shadow-lg shadow-black/30" />
          </a>
          <div className="relative rounded-3xl overflow-hidden mb-4 shadow-2xl shadow-black/40">
            <img src={driverHero} alt="Happy OSI Logistics truck driver" className="w-full h-72 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
            <p className="absolute bottom-3 left-4 right-4 text-white font-bold text-base leading-snug text-left drop-shadow-md">
              {t('registerDriver.heroPersuasion')}
            </p>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('registerDriver.heroTitle')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('registerDriver.heroSubtitle')}</p>
        </div>

        {/* Trust band -- the two angles the Oct-2026 research/creative round
            validated (transparency on the 93/7 split, no forced dispatch)
            plus 24/7 support. Added because Meta Insights showed real
            drop-off exactly here: visitors reached this page and left
            without starting the form -- a bare form with no reason to
            trust OSI wasn't converting, regardless of ad spend. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 flex items-center gap-3 sm:flex-col sm:text-center sm:gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-300 leading-snug">{t('registerDriver.trustEarnings')}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 flex items-center gap-3 sm:flex-col sm:text-center sm:gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-xs text-slate-300 leading-snug">{t('registerDriver.trustControl')}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 flex items-center gap-3 sm:flex-col sm:text-center sm:gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-300 leading-snug">{t('registerDriver.trustSupport')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-2xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Equipment first -- a single tap, no typing, decides which
              license field and which authority type show up next. */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Truck className="w-[18px] h-[18px] text-blue-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{t('registerDriver.sectionEquipmentFirst')}</h2>
            </div>
            <Field label={t('registerDriver.equipmentTypeLabel')} required>
              <select className="input" value={form.equipment_type} onChange={handleEquipmentChange} required>
                <option value="" disabled>{t('registerDriver.equipmentTypePlaceholder')}</option>
                {EQUIPMENT_TYPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </Field>
            {form.equipment_type && (
              <p className="text-xs text-gray-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                {requiresCdl ? t('registerDriver.cdlRequiredNote') : t('registerDriver.noCdlNote')}
              </p>
            )}
          </div>

          {form.equipment_type && (
          <>

          {/* Personal info */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <User className="w-[18px] h-[18px] text-blue-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{t('registerDispatcher.sectionPersonalInfo')}</h2>
            </div>

            <Field label={t('registerDispatcher.fullNameLabel')} required>
              <input className="input" type="text" placeholder="Diego Fuentes"
                value={form.name} onChange={set('name')} required autoFocus />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('registerDispatcher.phoneLabel')} required>
                <input className="input" type="tel" placeholder="(305) 555-0000"
                  value={form.phone} onChange={set('phone')} required />
              </Field>
              <Field label={t('registerDispatcher.emailLabel')} required>
                <input className="input" type="email" placeholder="driver@company.com"
                  value={form.email} onChange={set('email')} required />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('registerDispatcher.passwordLabel')} required>
                <div className="relative">
                  <input className="input pr-9" type={showPw ? 'text' : 'password'}
                    placeholder={t('registerDispatcher.passwordPlaceholderMin')} value={form.password}
                    onChange={set('password')} required />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="flex gap-1 mt-1.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength >= 4 ? 'bg-green-500' : strength >= 3 ? 'bg-blue-400' : strength >= 2 ? 'bg-yellow-400' : 'bg-red-400'
                          : 'bg-gray-100'
                      }`} />
                    ))}
                  </div>
                )}
              </Field>
              <Field label={t('registerDispatcher.confirmPasswordLabel')} required>
                <div className="relative">
                  <input className="input pr-9" type={showPw ? 'text' : 'password'}
                    placeholder={t('registerDispatcher.confirmPasswordPlaceholder')} value={form.confirm}
                    onChange={set('confirm')} required />
                  {form.confirm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirm
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </div>

          {/* CDL */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Hash className="w-[18px] h-[18px] text-orange-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{requiresCdl ? t('registerDriver.sectionCdlLicense') : t('registerDriver.sectionDriverLicense')}</h2>
            </div>
            <p className="text-xs text-gray-400 -mt-2 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
              {t('registerDriver.whyWeAskNote')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label={requiresCdl ? t('registerDriver.cdlLicenseNumberLabel') : t('registerDriver.driverLicenseNumberLabel')} required>
                <input className="input" type="text" placeholder={requiresCdl ? "FL-CDL-000000" : "FL-DL-000000"}
                  value={form.license_number} onChange={set('license_number')} required />
              </Field>
              <Field label={t('registerDriver.licenseExpiryLabel')} required>
                <DateField value={form.license_expiry} onChange={set('license_expiry')} required
                  placeholder={t('registerDriver.selectDate')} />
              </Field>
            </div>

          </div>

          {/* Company / Equipment */}
          <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-[18px] h-[18px] text-green-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{t('registerDriver.sectionCompanyEquipment')}</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                {t('registerDriver.authorityTypeLabel')}
              </label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 h-[42px] max-w-[200px]">
                {(['MC#', 'DOT#'] as const).map(type => (
                  <button key={type} type="button"
                    onClick={() => setAuthorityType(type)}
                    className={`flex-1 text-xs font-bold transition-colors ${
                      authorityType === type
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <Field label={authorityType}>
              <input className="input" type="text" placeholder="000000"
                value={authorityType === 'MC#' ? form.mc_number : form.dot_number}
                onChange={authorityType === 'MC#' ? set('mc_number') : set('dot_number')} />
            </Field>

            <Field label={t('registerDriver.companyNameLabel')}>
              <input className="input" type="text" placeholder="OSI Logistics INC"
                value={form.company_name} onChange={set('company_name')} />
            </Field>

            <Field label={t('registerDriver.authoritySinceLabel')}>
              <DateField value={form.authority_since} onChange={set('authority_since')}
                placeholder={t('registerDriver.selectDate')} />
            </Field>

            <Field label={t('registerDriver.rateConEmailLabel')}>
              <div className="relative">
                <Send className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className="input pl-9" type="email" placeholder="dispatch@tuempresa.com"
                  value={form.rate_con_email} onChange={set('rate_con_email')} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{t('registerDriver.rateConEmailHint')}</p>
            </Field>
          </div>

          {/* Declaration */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={declared}
                onChange={e => setDeclared(e.target.checked)}
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                declared
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-slate-400 bg-transparent group-hover:border-blue-400'
              }`}>
                {declared && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('registerDispatcher.declaration')}
            </p>
          </label>

          {/* Submit */}
          <button type="submit" disabled={loading || !declared}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base shadow-xl shadow-blue-500/20">
            {loading
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('registerDispatcher.creatingAccount')}</>
              : <><Lock className="w-4 h-4" /> {t('registerDriver.createAccountBtn')}</>
            }
          </button>

          <p className="text-xs text-center text-slate-500 -mt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            {t('registerDriver.privacyNote')}
          </p>

          </>
          )}

          <p className="text-xs text-center text-slate-500 pb-4">
            {t('registerDispatcher.alreadyHaveAccount')}{' '}
            <Link to="/driver/login" className="text-blue-400 hover:text-blue-300 font-medium">{t('registerDispatcher.signInHere')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
