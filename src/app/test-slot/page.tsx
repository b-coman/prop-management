"use client";

import { Slot } from '@radix-ui/react-slot';

export default function TestSlotPage() {
  return (
    <div className="p-10">
      <h1>Testing Radix Slot Directly</h1>
      
      <p>Standard button:</p>
      <button className="px-4 py-2 bg-blue-500 text-white rounded">
        Normal Button
      </button>
      
      <p className="mt-4">Button using Slot (should work):</p>
      <Slot className="px-4 py-2 bg-green-500 text-white rounded">
        <button>Slotted Button</button>
      </Slot>
      
      <p className="mt-4">Link using Slot with asChild pattern:</p>
      <Slot className="px-4 py-2 bg-purple-500 text-white rounded inline-block">
        <a href="/test">Slotted Link</a>
      </Slot>
    </div>
  );
}