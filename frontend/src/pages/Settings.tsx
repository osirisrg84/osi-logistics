import { useState } from 'react';
import { Save, Bell, Map, Truck, Shield, Globe, Palette, Server } from 'lucide-react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sections: SettingsSection[] = [
  { id: 'company', label: 'Company', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'dispatch', label: 'Dispatch Rules', icon: Truck },
  { id: 'tracking', label: 'Tracking', icon: Map },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api', label: 'API & Integrations', icon: Server },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('company');
  const [saved, setSaved] = useState(false);

  const [companySettings, setCompanySettings] = useState({
    company_name: 'OSI Logistics',
    company_email: 'dispatch@osilogistics.com',
    company_phone: '(305) 800-0001',
    company_address: '8888 NW 36th St, Doral, FL 33178',
    timezone: 'America/New_York',
    currency: 'USD',
    distance_unit: 'miles',
    weight_unit: 'kg',
  });

  const [notifSettings, setNotifSettings] = useState({
    order_created: true,
    order_assigned: true,
    order_delivered: true,
    driver_offline: true,
    low_fuel: true,
    maintenance_due: true,
    sound_enabled: true,
    email_alerts: false,
    sms_alerts: false,
  });

  const [dispatchSettings, setDispatchSettings] = useState({
    auto_assign: false,
    max_orders_per_driver: 3,
    assignment_radius_km: 50,
    priority_threshold: 'high',
    require_confirmation: true,
    allow_driver_decline: true,
  });

  const [trackingSettings, setTrackingSettings] = useState({
    update_interval_sec: 3,
    history_days: 30,
    idle_threshold_min: 10,
    geofence_alerts: true,
    speed_alerts: true,
    max_speed_kmh: 120,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 fade-in">
      {/* Sidebar */}
      <div className="w-full md:w-48 md:flex-shrink-0">
        <div className="card p-2 flex md:block overflow-x-auto gap-1">
          <nav className="flex md:flex-col gap-1 md:gap-0 md:space-y-0.5">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === id
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5">
        {activeSection === 'company' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Company Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Company Name</label>
                <input className="input" value={companySettings.company_name}
                  onChange={e => setCompanySettings({...companySettings, company_name: e.target.value})} />
              </div>
              <div>
                <label className="label">Dispatch Email</label>
                <input className="input" type="email" value={companySettings.company_email}
                  onChange={e => setCompanySettings({...companySettings, company_email: e.target.value})} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={companySettings.company_phone}
                  onChange={e => setCompanySettings({...companySettings, company_phone: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input className="input" value={companySettings.company_address}
                  onChange={e => setCompanySettings({...companySettings, company_address: e.target.value})} />
              </div>
              <div>
                <label className="label">Timezone</label>
                <select className="input" value={companySettings.timezone}
                  onChange={e => setCompanySettings({...companySettings, timezone: e.target.value})}>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input" value={companySettings.currency}
                  onChange={e => setCompanySettings({...companySettings, currency: e.target.value})}>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="MXN">MXN — Mexican Peso</option>
                </select>
              </div>
              <div>
                <label className="label">Distance Unit</label>
                <select className="input" value={companySettings.distance_unit}
                  onChange={e => setCompanySettings({...companySettings, distance_unit: e.target.value})}>
                  <option value="miles">Miles</option>
                  <option value="km">Kilometers</option>
                </select>
              </div>
              <div>
                <label className="label">Weight Unit</label>
                <select className="input" value={companySettings.weight_unit}
                  onChange={e => setCompanySettings({...companySettings, weight_unit: e.target.value})}>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lbs">Pounds (lbs)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Notification Preferences</h3>
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Order Events</p>
              {[
                { key: 'order_created', label: 'New order created' },
                { key: 'order_assigned', label: 'Order assigned to driver' },
                { key: 'order_delivered', label: 'Order delivered' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                  <button
                    onClick={() => setNotifSettings({...notifSettings, [key]: !notifSettings[key as keyof typeof notifSettings]})}
                    className={`w-10 h-5 rounded-full transition-colors ${notifSettings[key as keyof typeof notifSettings] ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${notifSettings[key as keyof typeof notifSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
              <p className="text-sm font-medium text-gray-700 mt-4">Fleet Alerts</p>
              {[
                { key: 'driver_offline', label: 'Driver goes offline unexpectedly' },
                { key: 'low_fuel', label: 'Low fuel level warning' },
                { key: 'maintenance_due', label: 'Maintenance due reminder' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                  <button
                    onClick={() => setNotifSettings({...notifSettings, [key]: !notifSettings[key as keyof typeof notifSettings]})}
                    className={`w-10 h-5 rounded-full transition-colors ${notifSettings[key as keyof typeof notifSettings] ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${notifSettings[key as keyof typeof notifSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
              <p className="text-sm font-medium text-gray-700 mt-4">Delivery Channels</p>
              {[
                { key: 'sound_enabled', label: 'Sound notifications' },
                { key: 'email_alerts', label: 'Email alerts' },
                { key: 'sms_alerts', label: 'SMS alerts' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                  <button
                    onClick={() => setNotifSettings({...notifSettings, [key]: !notifSettings[key as keyof typeof notifSettings]})}
                    className={`w-10 h-5 rounded-full transition-colors ${notifSettings[key as keyof typeof notifSettings] ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${notifSettings[key as keyof typeof notifSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'dispatch' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Dispatch Rules</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Auto-Assign Orders</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Automatically assign new orders to available drivers</p>
                </div>
                <button
                  onClick={() => setDispatchSettings({...dispatchSettings, auto_assign: !dispatchSettings.auto_assign})}
                  className={`w-10 h-5 rounded-full transition-colors ${dispatchSettings.auto_assign ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${dispatchSettings.auto_assign ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 py-3">
                <div>
                  <label className="label">Max Orders per Driver</label>
                  <input className="input" type="number" value={dispatchSettings.max_orders_per_driver}
                    onChange={e => setDispatchSettings({...dispatchSettings, max_orders_per_driver: parseInt(e.target.value)})} min="1" max="10" />
                </div>
                <div>
                  <label className="label">Assignment Radius (km)</label>
                  <input className="input" type="number" value={dispatchSettings.assignment_radius_km}
                    onChange={e => setDispatchSettings({...dispatchSettings, assignment_radius_km: parseInt(e.target.value)})} min="5" max="500" />
                </div>
                <div>
                  <label className="label">Auto-assign Priority Threshold</label>
                  <select className="input" value={dispatchSettings.priority_threshold}
                    onChange={e => setDispatchSettings({...dispatchSettings, priority_threshold: e.target.value})}>
                    <option value="urgent">Urgent only</option>
                    <option value="high">High & above</option>
                    <option value="normal">Normal & above</option>
                    <option value="all">All orders</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'tracking' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Tracking Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">GPS Update Interval (seconds)</label>
                <input className="input" type="number" value={trackingSettings.update_interval_sec}
                  onChange={e => setTrackingSettings({...trackingSettings, update_interval_sec: parseInt(e.target.value)})} min="1" max="60" />
              </div>
              <div>
                <label className="label">History Retention (days)</label>
                <input className="input" type="number" value={trackingSettings.history_days}
                  onChange={e => setTrackingSettings({...trackingSettings, history_days: parseInt(e.target.value)})} min="7" max="365" />
              </div>
              <div>
                <label className="label">Idle Threshold (minutes)</label>
                <input className="input" type="number" value={trackingSettings.idle_threshold_min}
                  onChange={e => setTrackingSettings({...trackingSettings, idle_threshold_min: parseInt(e.target.value)})} min="1" max="60" />
              </div>
              <div>
                <label className="label">Speed Alert Threshold (km/h)</label>
                <input className="input" type="number" value={trackingSettings.max_speed_kmh}
                  onChange={e => setTrackingSettings({...trackingSettings, max_speed_kmh: parseInt(e.target.value)})} min="60" max="200" />
              </div>
              <div className="col-span-2 space-y-3">
                {[
                  { key: 'geofence_alerts', label: 'Geofence alerts', desc: 'Alert when driver leaves designated area' },
                  { key: 'speed_alerts', label: 'Speed alerts', desc: 'Alert when driver exceeds speed limit' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{desc}</p>
                    </div>
                    <button
                      onClick={() => setTrackingSettings({...trackingSettings, [key]: !trackingSettings[key as keyof typeof trackingSettings]})}
                      className={`w-10 h-5 rounded-full transition-colors ${trackingSettings[key as keyof typeof trackingSettings] ? 'bg-orange-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${trackingSettings[key as keyof typeof trackingSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'appearance' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Appearance</h3>
            <div className="space-y-5">
              <div>
                <label className="label">Brand Color</label>
                <div className="flex items-center gap-3 mt-2">
                  {['#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#ef4444', '#0ea5e9'].map(color => (
                    <button key={color} className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Map Style</label>
                <select className="input w-48">
                  <option>OpenStreetMap</option>
                  <option>Dark Mode</option>
                  <option>Satellite</option>
                </select>
              </div>
              <div>
                <label className="label">Date Format</label>
                <select className="input w-48">
                  <option>MM/DD/YYYY</option>
                  <option>DD/MM/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'security' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Security Settings</h3>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800">✓ System is running securely</p>
                <p className="text-xs text-green-600 mt-1">All connections are encrypted and data is stored locally</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Session Timeout (minutes)</label>
                  <input className="input" type="number" defaultValue={60} min="15" max="480" />
                </div>
                <div>
                  <label className="label">Max Login Attempts</label>
                  <input className="input" type="number" defaultValue={5} min="3" max="10" />
                </div>
              </div>
              <div className="pt-2">
                <button className="btn-secondary">Change Password</button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'api' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">API & Integrations</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-slate-800/50 dark:bg-slate-900 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">Backend API</p>
                <p className="text-xs font-mono text-gray-600 bg-white rounded-lg p-2 border border-gray-200 dark:border-slate-600">http://localhost:3001/api</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800/50 dark:bg-slate-900 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">WebSocket (Real-time)</p>
                <p className="text-xs font-mono text-gray-600 bg-white rounded-lg p-2 border border-gray-200 dark:border-slate-600">ws://localhost:3001</p>
              </div>
              <div>
                <label className="label">Webhook URL (for order events)</label>
                <input className="input font-mono" placeholder="https://your-system.com/webhook" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs text-gray-600 dark:text-slate-400">API is online and accepting requests</span>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button onClick={handleSave} className={`btn-primary ${saved ? 'bg-green-500 hover:bg-green-600' : ''}`}>
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}



