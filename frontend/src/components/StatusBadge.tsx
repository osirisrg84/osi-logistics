import { OrderStatus, DriverStatus, TruckStatus, OrderPriority } from '../types';

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  picked_up: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  in_transit: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

const DRIVER_STATUS_STYLES: Record<DriverStatus, string> = {
  available: 'bg-green-100 text-green-700 border-green-200',
  busy: 'bg-orange-100 text-orange-700 border-orange-200',
  on_break: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  offline: 'bg-gray-100 text-gray-500 border-gray-200',
};

const DRIVER_STATUS_DOTS: Record<DriverStatus, string> = {
  available: 'bg-green-500',
  busy: 'bg-orange-500',
  on_break: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

const PRIORITY_STYLES: Record<OrderPriority, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  normal: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

const TRUCK_STATUS_STYLES: Record<TruckStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface OrderStatusBadgeProps { status: OrderStatus; className?: string; }
export function OrderStatusBadge({ status, className = '' }: OrderStatusBadgeProps) {
  return (
    <span className={`badge border ${ORDER_STATUS_STYLES[status]} ${className}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

interface DriverStatusBadgeProps { status: DriverStatus; className?: string; }
export function DriverStatusBadge({ status, className = '' }: DriverStatusBadgeProps) {
  return (
    <span className={`badge border ${DRIVER_STATUS_STYLES[status]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${DRIVER_STATUS_DOTS[status]}`} />
      {status.replace('_', ' ')}
    </span>
  );
}

interface PriorityBadgeProps { priority: OrderPriority; className?: string; }
export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  return (
    <span className={`badge border uppercase tracking-wide text-xs ${PRIORITY_STYLES[priority]} ${className}`}>
      {priority}
    </span>
  );
}

interface TruckStatusBadgeProps { status: TruckStatus; className?: string; }
export function TruckStatusBadge({ status, className = '' }: TruckStatusBadgeProps) {
  return (
    <span className={`badge border ${TRUCK_STATUS_STYLES[status]} ${className}`}>
      {status}
    </span>
  );
}
