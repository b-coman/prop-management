'use client';

import { useState } from 'react';
import { Check, Copy, Map, Phone, MessageCircle, Download, ExternalLink } from 'lucide-react';
import type { GuideData } from '../_lib/fetch-guide';

const COPY = {
  en: {
    welcome: (name?: string) => (name ? `Welcome, ${name}` : 'Welcome'),
    guide: 'Guest guide',
    arrive: 'Arrive',
    leave: 'Leave',
    from: 'from',
    by: 'by',
    wifi: 'Wi-Fi',
    network: 'network',
    password: 'password',
    copied: 'Copied',
    whoToCall: 'Who to call',
    trips: 'Trips & hikes',
    openMap: 'Open in Google Maps',
    downloadPdf: 'Download the printed guide',
    privateNote: 'Private link for your stay — please don’t share it.',
    bookCta: 'Check dates & book direct',
    // Deliberately subject-less: a contact may be one person or a couple.
    translationNote: (lang: string) =>
      `They don’t speak English — this button sends a message already written in ${lang}:`,
    kinds: { walk: 'walk', hike: 'hike', bike: 'bike', car: 'car' } as Record<string, string>,
  },
  ro: {
    welcome: (name?: string) => (name ? `Bine ai venit, ${name}` : 'Bine ai venit'),
    guide: 'Ghidul oaspetelui',
    arrive: 'Sosire',
    leave: 'Plecare',
    from: 'de la',
    by: 'până la',
    wifi: 'Wi-Fi',
    network: 'rețea',
    password: 'parolă',
    copied: 'Copiat',
    whoToCall: 'Pe cine suni',
    trips: 'Trasee și excursii',
    openMap: 'Deschide în Google Maps',
    downloadPdf: 'Descarcă ghidul tipărit',
    privateNote: 'Link privat pentru sejurul tău — te rugăm să nu îl distribui.',
    bookCta: 'Vezi disponibilitatea și rezervă direct',
    translationNote: (lang: string) =>
      `Nu vorbesc engleză — butonul trimite un mesaj deja scris în ${lang}:`,
    kinds: { walk: 'pe jos', hike: 'drumeție', bike: 'bicicletă', car: 'mașină' } as Record<string, string>,
  },
};

const LANGUAGE_NAMES: Record<string, Record<string, string>> = {
  en: { ro: 'Romanian', en: 'English' },
  ro: { ro: 'română', en: 'engleză' },
};

function WifiCard({ network, password, t }: { network: string; password: string; t: typeof COPY.en }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied) — the password is on
      // screen anyway, so there is nothing to recover from.
    }
  };

  return (
    <section className="rounded-xl border border-[#DDDAC7] bg-white p-4">
      <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6D7154]">
        {t.wifi}
      </h2>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-base font-semibold text-[#23260F]">{network}</p>
          <p className="mt-0.5 text-[11px] text-[#6D7154]">{t.network}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition hover:bg-[#F4F2E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E9A33]"
        >
          <span className="flex items-center gap-1.5 font-mono text-base font-semibold text-[#23260F]">
            <span className="truncate">{password}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-[#7E9A33]" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0 text-[#6D7154]" />
            )}
          </span>
          <span className="mt-0.5 block text-[11px] text-[#6D7154]">
            {copied ? t.copied : t.password}
          </span>
        </button>
      </div>
    </section>
  );
}

export default function GuideView({ data }: { data: GuideData }) {
  const t = COPY[data.language] ?? COPY.en;
  const isGuest = data.tier === 'guest';

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[#FBFAF3] pb-12">
      <header className="bg-[#414A22] px-5 pb-5 pt-6 text-[#F4F2E7]">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
          {data.propertyName}
        </p>
        <h1 className="mt-1 font-serif text-3xl italic leading-tight">
          {isGuest ? t.welcome(data.guestFirstName) : t.guide}
        </h1>

        {isGuest && data.checkIn && data.checkOut && (
          <dl className="mt-4 flex gap-4 border-t border-[#F4F2E7]/25 pt-3">
            <div className="flex-1">
              <dt className="text-[9.5px] font-bold uppercase tracking-[0.13em] opacity-75">
                {t.arrive}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{data.checkIn}</dd>
              {data.checkInTime && (
                <dd className="text-[10px] opacity-75">{`${t.from} ${data.checkInTime}`}</dd>
              )}
            </div>
            <div className="flex-1">
              <dt className="text-[9.5px] font-bold uppercase tracking-[0.13em] opacity-75">
                {t.leave}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{data.checkOut}</dd>
              {data.checkOutTime && (
                <dd className="text-[10px] opacity-75">{`${t.by} ${data.checkOutTime}`}</dd>
              )}
            </div>
          </dl>
        )}
      </header>

      <div className="flex flex-col gap-3 p-4">
        {data.wifi && <WifiCard network={data.wifi.network} password={data.wifi.password} t={t} />}

        {data.contacts.length > 0 && (
          <section className="rounded-xl border border-[#DDDAC7] bg-white p-4">
            <h2 className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6D7154]">
              {t.whoToCall}
            </h2>
            <ul>
              {data.contacts.map((c) => (
                <li
                  key={c.phone}
                  className="flex items-center gap-3 border-b border-[#DDDAC7] py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-[#23260F]">{c.name}</p>
                    {c.role && <p className="mt-0.5 text-[11px] leading-snug text-[#6D7154]">{c.role}</p>}
                  </div>
                  <a
                    href={c.href}
                    target={c.channel === 'whatsapp' ? '_blank' : undefined}
                    rel={c.channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#414A22] px-3 py-2 text-[11px] font-bold text-[#F4F2E7] transition hover:bg-[#4E5A29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E9A33]"
                  >
                    {c.channel === 'call' ? (
                      <Phone className="h-3.5 w-3.5" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    {c.channel === 'whatsapp' ? 'WhatsApp' : c.channel === 'sms' ? 'SMS' : c.phone}
                  </a>
                </li>
              ))}
            </ul>

            {data.contacts
              .filter((c) => c.needsTranslation && c.prefillText)
              .map((c) => (
                <p
                  key={`${c.phone}-note`}
                  className="mt-3 rounded-lg border border-[#DDDAC7] bg-[#F4F2E7] px-3 py-2.5 text-[11px] leading-relaxed text-[#6D7154]"
                >
                  {t.translationNote(LANGUAGE_NAMES[data.language]?.ro ?? 'Romanian')}
                  <span className="mt-1.5 block font-mono text-[10.5px] leading-relaxed text-[#414A22]">
                    „{c.prefillText}”
                  </span>
                </p>
              ))}
          </section>
        )}

        {(data.routes.length > 0 || data.mapUrl) && (
          <section className="rounded-xl border border-[#DDDAC7] bg-white p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6D7154]">
              <Map className="h-3 w-3" />
              {t.trips}
            </h2>
            {data.routes.length > 0 && (
              <ul className="mb-3">
                {data.routes.map((r) => (
                  <li
                    key={`${r.name}-${r.km}`}
                    className="flex items-baseline gap-2 border-b border-[#DDDAC7] py-1.5 text-[12px] last:border-b-0"
                  >
                    <span className="w-16 shrink-0 text-[8.5px] font-extrabold uppercase tracking-[0.1em] text-[#414A22]">
                      {t.kinds[r.kind] ?? r.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[#23260F]">{r.name}</span>
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[#6D7154]">
                      {r.km} km
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.mapUrl && (
              <a
                href={data.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#414A22] px-3 py-2.5 text-[12px] font-bold text-[#414A22] transition hover:bg-[#F4F2E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E9A33]"
              >
                {t.openMap}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </section>
        )}

        {data.sections.map((s) => (
          <section key={s.id} className="rounded-xl border border-[#DDDAC7] bg-white p-4">
            <h2 className="mb-2 text-base font-bold text-[#23260F]">{s.title}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#3B3F26]">{s.body}</p>
          </section>
        ))}

        {!isGuest && (
          <a
            href={`/properties/${data.propertySlug}/booking`}
            className="rounded-xl bg-[#7E9A33] px-4 py-3 text-center text-sm font-extrabold text-[#17190B] transition hover:bg-[#8FAC3C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#414A22]"
          >
            {t.bookCta}
          </a>
        )}

        {data.pdf && (
          <a
            href={data.pdf.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-1 text-center text-[11px] text-[#414A22] underline"
          >
            <Download className="h-3 w-3" />
            {t.downloadPdf}
            {data.pdf.sizeBytes
              ? ` (${(data.pdf.sizeBytes / 1024 / 1024).toFixed(1)} MB)`
              : ''}
          </a>
        )}

        {isGuest && (
          <p className="px-4 text-center text-[10.5px] leading-relaxed text-[#6D7154]">
            {t.privateNote}
          </p>
        )}
      </div>
    </main>
  );
}
