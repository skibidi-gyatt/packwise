'use client';
import { useState } from 'react';
import type { Container } from '@/lib/packing/model';
import Planner from './Planner';
import TransportLanding from './TransportLanding';

export default function WebsiteEntry() {
  const [transport, setTransport] = useState<Container | null>(null);
  return transport ? (
    <Planner initialTransport={transport} />
  ) : (
    <TransportLanding
      onSelect={(next) => {
        setTransport(next);
        window.scrollTo(0, 0);
      }}
    />
  );
}
