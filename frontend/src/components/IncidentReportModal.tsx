import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const INCIDENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'accidente', label: 'Accidente' },
  { value: 'retraso', label: 'Retraso' },
  { value: 'carga_dañada', label: 'Carga dañada' },
  { value: 'vehiculo', label: 'Problema con el vehículo' },
  { value: 'comportamiento', label: 'Comportamiento' },
  { value: 'otro', label: 'Otro' },
];

interface IncidentReportModalProps {
  onClose: () => void;
  createIncident: (data: { category: string; description: string; order_number?: string }) => Promise<unknown>;
}

export function IncidentReportModal({ onClose, createIncident }: IncidentReportModalProps) {
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
      alert('No se pudo enviar el reporte. Intenta de nuevo.');
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
            <p className="font-semibold text-gray-900 dark:text-white">Incidente reportado</p>
            <p className="text-sm mt-1 text-gray-500 dark:text-slate-400">El equipo de OSI fue notificado.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900 dark:text-white">Reportar Incidente</p>
              <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={category} onChange={e => setCategory(e.target.value)} className="input w-full">
                <option value="">Selecciona una categoría</option>
                {INCIDENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input className="input w-full" placeholder="N° de orden (opcional)" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} />
              <textarea className="input w-full" rows={4} placeholder="Describe lo que ocurrió..." value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} />
              <button
                disabled={!category || !description.trim() || saving}
                onClick={submit}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-400 disabled:opacity-40 transition-all">
                {saving ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
