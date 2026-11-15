import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';

const INCIDENT_CATEGORIES: { value: string; labelKey: string }[] = [
  { value: 'accidente', labelKey: 'incident.catAccident' },
  { value: 'retraso', labelKey: 'incident.catDelay' },
  { value: 'carga_dañada', labelKey: 'incident.catDamagedCargo' },
  { value: 'vehiculo', labelKey: 'incident.catVehicle' },
  { value: 'comportamiento', labelKey: 'incident.catBehavior' },
  { value: 'otro', labelKey: 'incident.catOther' },
];

interface IncidentReportModalProps {
  onClose: () => void;
  createIncident: (data: { category: string; description: string; order_number?: string }) => Promise<unknown>;
}

export function IncidentReportModal({ onClose, createIncident }: IncidentReportModalProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!category || !description.trim()) return;
    setSaving(true);
    try {
      await createIncident({ category, description: description.trim(), order_number: orderNumber.trim() });
      setDone(true);
      setTimeout(onClose, 1600);
    } catch {
      alert(t('incident.sendError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-md p-5 bg-white dark:bg-slate-800" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">{t('incident.reported')}</p>
            <p className="text-sm mt-1 text-gray-500 dark:text-slate-400">{t('incident.teamNotified')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900 dark:text-white">{t('incident.title')}</p>
              <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={category} onChange={e => setCategory(e.target.value)} className="input w-full">
                <option value="">{t('incident.selectCategory')}</option>
                {INCIDENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
              </select>
              <input className="input w-full" placeholder={t('incident.orderNumberPlaceholder')} value={orderNumber} onChange={e => setOrderNumber(e.target.value)} />
              <textarea className="input w-full" rows={4} placeholder={t('incident.describePlaceholder')} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} />
              <button
                disabled={!category || !description.trim() || saving}
                onClick={submit}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-400 disabled:opacity-40 transition-all">
                {saving ? t('incident.sending') : t('incident.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
