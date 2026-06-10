export type DriverStatus = 'available' | 'busy' | 'offline' | 'on_break';
export type TruckStatus = 'active' | 'maintenance' | 'inactive';
export type OrderStatus = 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationType = 'order' | 'driver' | 'truck' | 'system' | 'alert';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  license_number: string;
  license_expiry: string;
  status: DriverStatus;
  current_lat: number;
  current_lng: number;
  current_address: string;
  truck_id: string | null;
  rating: number;
  total_deliveries: number;
  on_time_rate: number;
  avatar: string;
  hire_date: string;
  created_at: string;
  plate_number?: string;
  make?: string;
  model?: string;
  truck_type?: string;
  equipment_type?: string;
  company_name?: string;
  mc_number?: string;
  authority_since?: string;
  payment_method?: string;
  payment_details?: string;
  active_orders?: number;
  order_id?: string;
  order_number?: string;
  order_status?: string;
  delivery_address?: string;
  estimated_delivery?: string;
}

export interface Truck {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  type: string;
  capacity_kg: number;
  capacity_m3: number;
  status: TruckStatus;
  mileage: number;
  fuel_level: number;
  last_maintenance: string;
  next_maintenance: string;
  vin: string;
  color: string;
  created_at: string;
  driver_name?: string;
  assigned_driver_id?: string;
  active_orders?: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_contact: string;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_contact: string;
  status: OrderStatus;
  priority: OrderPriority;
  weight_kg: number;
  volume_m3: number;
  description: string;
  notes: string;
  driver_id: string | null;
  truck_id: string | null;
  created_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  price: number;
  distance_km: number;
  driver_name?: string;
  driver_phone?: string;
  plate_number?: string;
}

export interface OrderHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  timestamp: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  created_by: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  related_id: string | null;
}

export interface DashboardStats {
  ordersByStatus: Array<{ status: string; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  topDrivers: Array<{
    name: string;
    rating: number;
    total_deliveries: number;
    on_time_rate: number;
    avatar: string;
    recent_deliveries: number;
    revenue: number;
  }>;
  deliveryByHour: Array<{ hour: string; count: number }>;
  ordersByPriority: Array<{ priority: string; count: number }>;
  recentActivity: Array<{
    status: string;
    timestamp: string;
    notes: string;
    order_number: string;
    customer_name: string;
    driver_name: string;
  }>;
  kpis: {
    total_revenue: number;
    monthly_revenue: number;
    avg_order_value: number;
    on_time_rate: number;
    avg_delivery_hours: number;
    customer_satisfaction: number;
  };
}
