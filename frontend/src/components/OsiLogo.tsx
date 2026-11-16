import logoColor from '../assets/osi-logo-color.svg';
import logoDark from '../assets/osi-logo-dark.svg';

/** Logo oficial de OSI (vectorial). 'dark' = para fondos oscuros, 'light' = para fondos claros, 'auto' = según el tema. */
export default function OsiLogo({ variant = 'dark', className = '' }: { variant?: 'dark' | 'light' | 'auto'; className?: string }) {
  if (variant === 'auto') {
    return (
      <>
        <img src={logoColor} alt="OSI Logistics" className={`${className} dark:hidden`} />
        <img src={logoDark} alt="OSI Logistics" className={`${className} hidden dark:block`} />
      </>
    );
  }
  return <img src={variant === 'light' ? logoColor : logoDark} alt="OSI Logistics" className={className} />;
}
