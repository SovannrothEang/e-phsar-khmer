
import React from 'react';
import { detectCambodiaNetwork } from '@/utils/telecom'; 
import Image from 'next/image';

interface PhoneNumberDisplayProps {
  phoneNumber: string;
}

export function PhoneNumberDisplay({ phoneNumber }: PhoneNumberDisplayProps) {

  const networkDetails = {
    Cellcard: {
      logo: '/sub-img/phones-tablets/phone-number/cellcard.png',
      alt: 'Cellcard CamGSM'
    },
    Metfone: {
      logo: '/sub-img/phones-tablets/phone-number/metfone.png',
      alt: 'Metfone Viettel'
    },
    Smart: {
      logo: '/sub-img/phones-tablets/phone-number/smart.png',
      alt: 'Smart Axiata'
    },
    Seatel: {
      logo: '/sub-img/phones-tablets/phone-number/seatel.png',
      alt: 'Seatel'
    },
    Qube: {
      logo: '/sub-img/phones-tablets/phone-number/qube.png',
      alt: 'Qube'
    }
  };
  const [phone, setPhone] = useState('');
  const network = detectCambodiaNetwork(phone);

  return (
    <div className="flex items-center gap-2 font-medium text-slate-900 text-lg">
      {/* If a network is detected, show its specific logo square */}
      {network && networkDetails[network] && (
        <Image
          src={networkDetails[network].logo}
          alt={networkDetails[network].alt}
          className="h-6 w-6 rounded-md object-cover shadow-sm select-none"
          width={24}
          height={24}
        />
      )}
      {/* Fallback placeholder logo box if network is unknown */}
      {!network && (
        <div className="h-6 w-6 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold">
          TEL
        </div>
      )}
      {/* The Phone Number text */}
      <span className="tracking-wide">{phoneNumber}</span>
    </div>
  );
}

function useState(arg0: string): [any, any] {
  throw new Error('Function not implemented.');
}
