import { EventEmitter } from 'events';

export interface DriverStatusEvent {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  avatar: string;
}

export const appEvents = new EventEmitter();
