// Medicion de conversiones del registro (dispatcher / driver) para Meta, Google y TikTok.
// Cada plataforma solo recibe el evento si su script esta cargado: no hay errores si falta alguna.
//
// - Meta: CompleteRegistration (el pixel ya esta en index.html y driver.html).
// - Google Analytics 4: sign_up (GA4 ya esta cargado con gtag).
// - Google Ads: conversion si se configuran VITE_GOOGLE_ADS_ID y VITE_GOOGLE_ADS_REG_LABEL (vacios = no se envia).
// - TikTok: CompleteRegistration si el pixel (ttq) esta cargado en la pagina.
//
// No se envia ningun dato personal: solo el tipo de registro.

type Role = 'driver' | 'dispatcher';

interface Win extends Window {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
}

export function trackRegistration(role: Role): void {
  try {
    const w = window as Win;
    const name = `${role}_registration`;
    w.fbq?.('track', 'CompleteRegistration', { content_name: name });
    w.gtag?.('event', 'sign_up', { method: role });
    const adsId = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
    const adsLabel = import.meta.env.VITE_GOOGLE_ADS_REG_LABEL as string | undefined;
    if (adsId && adsLabel) w.gtag?.('event', 'conversion', { send_to: `${adsId}/${adsLabel}` });
    w.ttq?.track('CompleteRegistration', { content_name: name });
  } catch {
    // la medicion nunca debe romper el registro
  }
}
