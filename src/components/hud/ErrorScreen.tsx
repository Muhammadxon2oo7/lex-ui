'use client';
/**
 * Shown when a room fails to load or render (a model, a texture, the 3D
 * context): the case itself is kept on the server, so trying again or going
 * back to the terminal loses nothing.
 */
import Link from 'next/link';
import { useEffect } from 'react';

export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid h-dvh place-items-center bg-[#0c0f14] p-6 text-white">
      <section role="alert" className="w-full max-w-md rounded-[28px] bg-[#0d121b] p-7 ring-1 ring-white/10">
        <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-amber-200 uppercase">Xona ochilmadi</p>
        <h1 className="mt-2 text-[1.35rem] leading-tight font-semibold">Sahnani yuklashda xatolik yuz berdi</h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-white/70">
          Ish serverda saqlangan - hech narsa yoʻqolmadi. Qayta urinib koʻring yoki terminalga qayting. Muammo takrorlansa, brauzerni yangilang yoki apparat tezlatgichi (WebGL) yoqilganini tekshiring.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => retry()} autoFocus>Qayta urinish</button>
          <Link href="/kampus" className="btn btn-quiet">Terminal</Link>
        </div>
      </section>
    </main>
  );
}
