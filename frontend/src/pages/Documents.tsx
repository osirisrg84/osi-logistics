import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Search, RefreshCw, XCircle, FileBadge, Contact, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import api, { adminApi } from '../services/api';

type DocType = 'dispatcher_id' | 'driver_license' | 'driver_coi';

interface DocumentRow {
  doc_type: DocType;
  entity_id: string;
  name: string;
  email: string;
  filename: string;
  uploaded_at: string;
}

const TYPE_ENDPOINT: Record<DocType, (id: string) => string> = {
  dispatcher_id: id => `/admin/dispatchers/${id}/id-document`,
  driver_license: id => `/drivers/${id}/license-document`,
  driver_coi: id => `/drivers/${id}/coi-document`,
};

const TYPE_ICON: Record<DocType, React.ReactNode> = {
  dispatcher_id: <Contact className="w-4 h-4" />,
  driver_license: <FileBadge className="w-4 h-4" />,
  driver_coi: <ShieldCheck className="w-4 h-4" />,
};

const TYPE_COLOR: Record<DocType, string> = {
  dispatcher_id: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  driver_license: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  driver_coi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function Documents() {
  const { t } = useTranslation();
  const TYPE_LABEL: Record<DocType, string> = {
    dispatcher_id: t('documents.typeDispatcherId'),
    driver_license: t('documents.typeDriverLicense'),
    driver_coi: t('documents.typeDriverCoi'),
  };

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | DocType>('all');
  const [viewing, setViewing] = useState<string | null>(null);
  const [modal, setModal] = useState<{ name: string; filename: string; data: string } | null>(null);

  const fetchData = async () => {
    try {
      const { data } = await adminApi.getDocuments();
      setDocs(data);
    } catch {
      // keep whatever was previously loaded
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openDocument = async (row: DocumentRow) => {
    const key = `${row.doc_type}:${row.entity_id}`;
    setViewing(key);
    try {
      const { data } = await api.get(TYPE_ENDPOINT[row.doc_type](row.entity_id));
      setModal({ name: row.name, filename: data.filename, data: data.data });
    } catch {
      // no document on file, or fetch failed — silently no-op
    } finally {
      setViewing(null);
    }
  };

  const filtered = docs.filter(d => {
    if (filter !== 'all' && d.doc_type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.email.toLowerCase().includes(q);
  });

  const countFor = (type: DocType) => docs.filter(d => d.doc_type === type).length;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-purple-500" /> {t('documents.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{t('documents.subtitle')}</p>
        </div>
        <button onClick={() => { setLoading(true); fetchData(); }}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> {t('documents.refresh')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('documents.statAll'), value: docs.length, filter: 'all' as const, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: t('documents.typeDispatcherId'), value: countFor('dispatcher_id'), filter: 'dispatcher_id' as const, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: t('documents.typeDriverLicense'), value: countFor('driver_license'), filter: 'driver_license' as const, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: t('documents.typeDriverCoi'), value: countFor('driver_coi'), filter: 'driver_coi' as const, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        ].map(s => (
          <button key={s.label} onClick={() => setFilter(s.filter)}
            className={`card ${s.bg} p-4 text-left transition-all ${filter === s.filter ? 'ring-2 ring-purple-400' : ''}`}>
            <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 flex-shrink-0 text-xs font-semibold">
          {([
            ['all', t('documents.filterAll')],
            ['dispatcher_id', t('documents.typeDispatcherId')],
            ['driver_license', t('documents.typeDriverLicense')],
            ['driver_coi', t('documents.typeDriverCoi')],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-2 transition-colors ${filter === v ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'} ${v !== 'all' ? 'border-l border-gray-200 dark:border-slate-700' : ''}`}
            >{l}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder={t('documents.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">{t('documents.loadingDocuments')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">{t('documents.noDocumentsFound')}</div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-slate-700 overflow-hidden">
          {filtered.map(d => {
            const key = `${d.doc_type}:${d.entity_id}`;
            return (
              <div key={key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[d.doc_type]}`}>
                  {TYPE_ICON[d.doc_type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{d.name}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[d.doc_type]}`}>{TYPE_LABEL[d.doc_type]}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{d.email} · {d.filename}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
                    {d.uploaded_at ? format(new Date(d.uploaded_at), 'MMM d, yyyy') : '—'}
                  </span>
                  <button onClick={() => openDocument(d)} disabled={viewing === key}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 flex-shrink-0">
                    {viewing === key ? '...' : t('documents.view')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{modal.name}</p>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {modal.data.startsWith('data:application/pdf') ? (
              <a href={modal.data} download={modal.filename} className="text-sm text-blue-500 underline">{modal.filename}</a>
            ) : (
              <img src={modal.data} alt={modal.filename} className="w-full rounded-xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
