'use client';

import { useEffect, useState } from 'react';
import {
  BedDouble,
  BookOpen,
  Car,
  Check,
  ChevronDown,
  ClipboardCheck,
  Compass,
  CookingPot,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Footprints,
  Home,
  Info,
  Map,
  MessageCircle,
  Mountain,
  Navigation,
  Phone,
  ScrollText,
  ShoppingBasket,
  Siren,
  Sun,
  Trees,
  Tv,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { GuideData, GuideGroup } from '../_lib/fetch-guide';

const COPY = {
  en: {
    welcome: (name?: string) => (name ? `Welcome, ${name}` : 'Welcome'),
    guide: 'Guest guide',
    arrive: 'You arrive',
    leave: 'You leave',
    arrived: 'You arrived',
    leaving: 'You leave',
    from: 'from',
    by: 'by',
    wifi: 'Wi-Fi',
    network: 'network',
    password: 'password',
    copied: 'Copied',
    arrival: 'Getting here',
    maps: 'Google Maps',
    gate: 'Look for this number on the gate',
    lockbox: 'Key box code',
    whoToCall: 'Who to call',
    trips: 'Trips & hikes',
    openMap: 'Open in Google Maps',
    downloadPdf: 'Download the printed guide',
    privateNote: 'Private link for your stay - please don’t share it.',
    bookCta: 'Check dates & book direct',
    // Deliberately subject-less: a contact may be one person or a couple.
    translationNote: (lang: string) =>
      `They don’t speak English - this button sends a message already written in ${lang}:`,
    kinds: { walk: 'walk', hike: 'hike', bike: 'bike', car: 'car' } as Record<string, string>,
    bands: {
      intro: '',
      house: 'In the house',
      around: 'Around here',
      place: 'The house & the valley',
    } as Record<string, string>,
  },
  ro: {
    welcome: (name?: string) => (name ? `Bine ai venit, ${name}` : 'Bine ai venit'),
    guide: 'Ghidul oaspetelui',
    arrive: 'Sosiți',
    leave: 'Plecați',
    arrived: 'Ați sosit',
    leaving: 'Plecați',
    from: 'de la',
    by: 'până la',
    wifi: 'Wi-Fi',
    network: 'rețea',
    password: 'parolă',
    copied: 'Copiat',
    arrival: 'Cum ajungeți',
    maps: 'Google Maps',
    gate: 'Căutați numărul acesta pe poartă',
    lockbox: 'Codul cutiei de chei',
    whoToCall: 'Pe cine suni',
    trips: 'Trasee și excursii',
    openMap: 'Deschide în Google Maps',
    downloadPdf: 'Descarcă ghidul tipărit',
    privateNote: 'Link privat pentru sejurul tău - te rugăm să nu îl distribui.',
    bookCta: 'Vezi disponibilitatea și rezervă direct',
    translationNote: (lang: string) =>
      `Nu vorbesc engleză - butonul trimite un mesaj deja scris în ${lang}:`,
    kinds: { walk: 'pe jos', hike: 'drumeție', bike: 'bicicletă', car: 'mașină' } as Record<string, string>,
    bands: {
      intro: '',
      house: 'În casă',
      around: 'Prin zonă',
      place: 'Casa și valea',
    } as Record<string, string>,
  },
};

const LANGUAGE_NAMES: Record<string, Record<string, string>> = {
  en: { ro: 'Romanian', en: 'English' },
  ro: { ro: 'română', en: 'engleză' },
};

/**
 * One icon per section, keyed by the section id from Firestore. Wayfinding, not
 * decoration: a returning guest recognises the shape faster than the words. A
 * section with no entry falls back to a neutral dot, so unknown ids stay tidy.
 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  'things-to-know': Info,
  'house-rules': ScrollText,
  appliances: Tv,
  emergency: Siren,
  'before-you-go': ClipboardCheck,
  'getting-around': Car,
  'things-to-do': Footprints,
  'closer-to-home': Compass,
  'places-to-see': Mountain,
  'places-to-eat': UtensilsCrossed,
  nearest: ShoppingBasket,
  host: UserRound,
  'about-house': Home,
  rooms: BedDouble,
  kitchen: CookingPot,
  'living-room': Flame,
  terrace: Sun,
  yard: Trees,
  history: BookOpen,
};

/**
 * Bold the lead-in term of each paragraph so the eye can skim to the right one.
 * Content is written as "Term - description" or "Term: description", so lead-ins
 * are inferred rather than marked up. Two guards keep this from bolding prose,
 * which contains dashes mid-sentence:
 *
 *   1. a label is at most four words ("Bedsheets & towels", not "For me you are
 *      more than just guests - you are part of a story");
 *   2. a labelled list has at least two of them. One match in a section means a
 *      sentence happened to contain a dash, so nothing is bolded.
 */
const LEAD_IN = /^([^\n:]{1,42}?)(\s-\s|:\s)/;

function leadIn(para: string): string | null {
  const m = para.match(LEAD_IN);
  if (!m) return null;
  return m[1].trim().split(/\s+/).length <= 4 ? m[1] : null;
}

function SectionBody({ text }: { text: string }) {
  const paras = text.split('\n\n');
  const leads = paras.map(leadIn);
  const isLabelledList = leads.filter(Boolean).length >= 2;

  return (
    <>
      {paras.map((para, i) => (
        <p key={i} className="mt-2 whitespace-pre-line first:mt-0">
          {isLabelledList && leads[i] ? (
            <>
              <strong className="font-semibold text-[#23260F]">{leads[i]}</strong>
              {para.slice(leads[i]!.length)}
            </>
          ) : (
            para
          )}
        </p>
      ))}
    </>
  );
}

function WifiCard({ network, password, t }: { network: string; password: string; t: typeof COPY.en }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied) - the password is on
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

function TripsCard({ data, t }: { data: GuideData; t: typeof COPY.en }) {
  if (data.routes.length === 0 && !data.mapUrl) return null;
  return (
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
  );
}

function ArrivalCard({
  a,
  t,
}: {
  a: NonNullable<GuideData['arrival']>;
  t: typeof COPY.en;
}) {
  // No Plus code here on purpose: it resolves to the same point in the same app
  // as the Maps link, but costs the guest a copy, an app switch and a paste. It
  // stays in the platform message, where a link can be mangled or read aloud.
  const link =
    'flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#414A22] px-2 py-2.5 text-[12px] font-bold text-[#414A22] transition hover:bg-[#F4F2E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E9A33]';

  return (
    <section className="rounded-xl border border-[#DDDAC7] bg-white p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6D7154]">
        <Navigation className="h-3 w-3" />
        {t.arrival}
      </h2>

      <div className="flex gap-2">
        {a.wazeUrl && (
          <a
            className={`${link} flex-1`}
            href={a.wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="h-3.5 w-3.5" />
            Waze
          </a>
        )}
        {a.mapsUrl && (
          <a
            className={`${link} flex-1`}
            href={a.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Map className="h-3.5 w-3.5" />
            {t.maps}
          </a>
        )}
      </div>

      {a.gateNumber && (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#DDDAC7] bg-[#F4F2E7] px-3 py-2.5">
          <span className="text-[11.5px] leading-snug text-[#6D7154]">{t.gate}</span>
          <strong className="font-mono text-xl font-bold tracking-[0.08em] text-[#23260F]">
            {a.gateNumber}
          </strong>
        </p>
      )}

      {a.call && (
        <p className="mt-3 rounded-lg bg-[#414A22] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#F4F2E7]">
          {a.call}
        </p>
      )}

      {a.lockboxCode && (
        <p className="mt-2 flex items-baseline gap-2 rounded-lg border border-[#DDDAC7] bg-[#F4F2E7] px-3 py-2.5 text-[11px] text-[#6D7154]">
          {t.lockbox}
          <strong className="font-mono text-base tracking-[0.15em] text-[#23260F]">
            {a.lockboxCode}
          </strong>
        </p>
      )}

      {a.access && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-[#6D7154]">{a.access}</p>
      )}
    </section>
  );
}

export default function GuideView({ data }: { data: GuideData }) {
  const t = COPY[data.language] ?? COPY.en;
  const isGuest = data.tier === 'guest';

  // A guest wants the practical bands first; a visitor still deciding wants the
  // house before the surroundings.
  const bands: GuideGroup[] = isGuest
    ? ['intro', 'house', 'around', 'place']
    : ['intro', 'place', 'around', 'house'];

  // On checkout morning the departure checklist is lifted out of its band and
  // shown open at the top, so it is not row five of something collapsed.
  const departure = data.departing
    ? data.sections.find((s) => s.id === 'before-you-go')
    : undefined;
  const sections = departure
    ? data.sections.filter((s) => s.id !== departure.id)
    : data.sections;

  // One section open at a time. Closing a section above the one just opened
  // would slide it out from under the finger, so the scroll position is
  // corrected by however much the tapped row moved.
  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const el = e.currentTarget;
    if (!el.open) return;
    const before = el.getBoundingClientRect().top;
    document.querySelectorAll<HTMLDetailsElement>('details[data-guide-section]').forEach((d) => {
      if (d !== el) d.open = false;
    });
    const shift = el.getBoundingClientRect().top - before;
    if (shift !== 0) window.scrollBy({ top: shift });
  };

  // Open the section a link points at, e.g. /guide/x?t=y#appliances.
  // Driven through the DOM rather than a React `open` prop: <details> toggles
  // itself natively on click, and a controlled attribute fights that.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace('#', ''));
    if (!id) return;
    const el = document.getElementById(id);
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
      el.scrollIntoView({ block: 'start' });
    }
  }, []);

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
                {data.stayStarted ? t.arrived : t.arrive}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{data.checkIn}</dd>
              {data.checkInTime && (
                <dd className="text-[10px] opacity-75">{`${t.from} ${data.checkInTime}`}</dd>
              )}
            </div>
            <div className="flex-1">
              <dt className="text-[9.5px] font-bold uppercase tracking-[0.13em] opacity-75">
                {data.stayStarted ? t.leaving : t.leave}
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
        {data.arrival && data.arrivalLeads && <ArrivalCard a={data.arrival} t={t} />}

        {data.wifi && <WifiCard network={data.wifi.network} password={data.wifi.password} t={t} />}

        {data.arrival && !data.arrivalLeads && <ArrivalCard a={data.arrival} t={t} />}

        {/* Checkout morning: the list of things the host needs done stops being
            row five of a collapsed band and leads instead. */}
        {departure && (
          <section className="rounded-xl border-[1.5px] border-[#7E9A33] bg-white p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6D7154]">
              <ClipboardCheck className="h-3 w-3" />
              {departure.title}
            </h2>
            <div className="text-sm leading-relaxed text-[#3B3F26]">
              <SectionBody text={departure.body} />
            </div>
          </section>
        )}

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
                  {t.translationNote(
                    LANGUAGE_NAMES[data.language]?.[c.prefillLanguage ?? 'ro'] ?? 'Romanian',
                  )}
                  <span className="mt-1.5 block font-mono text-[10.5px] leading-relaxed text-[#414A22]">
                    „{c.prefillText}”
                  </span>
                </p>
              ))}
          </section>
        )}


        {bands.map((band) => {
          const inBand = sections.filter((s) => s.group === band);
          // Trips keeps its card treatment, but belongs with the rest of
          // "around here" rather than competing with the utility block.
          const lead = band === 'around' ? <TripsCard data={data} t={t} /> : null;
          if (inBand.length === 0 && !lead) return null;

          // The intro is prose, not a lookup - it stays open and unlabelled.
          if (band === 'intro') {
            return inBand.map((s) => (
              <section key={s.id} className="rounded-xl border border-[#DDDAC7] bg-white p-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#3B3F26]">{s.body}</p>
              </section>
            ));
          }

          return (
            <div key={band} className="mt-2 flex flex-col gap-3">
              <h2 className="px-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6D7154]">
                {t.bands[band]}
              </h2>
              {lead}
              <section>
              <div className="overflow-hidden rounded-xl border border-[#DDDAC7] bg-white">
                {inBand.map((s) => (
                  <details
                    key={s.id}
                    id={s.id}
                    data-guide-section
                    onToggle={handleToggle}
                    className="group border-b border-[#DDDAC7] last:border-b-0"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-sm font-semibold text-[#23260F] marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7E9A33] [&::-webkit-details-marker]:hidden">
                      {(() => {
                        const Icon = SECTION_ICONS[s.id];
                        return Icon ? (
                          <Icon className="h-[17px] w-[17px] shrink-0 text-[#8A8F6C]" aria-hidden="true" />
                        ) : (
                          <span className="h-[17px] w-[17px] shrink-0" />
                        );
                      })()}
                      <span className="flex-1">{s.title}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#6D7154] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <div className="px-4 pb-4 pl-[52px] text-sm leading-relaxed text-[#3B3F26]">
                      {s.image?.url && (
                        <img
                          src={s.image.url}
                          alt={s.image.alt ?? ''}
                          loading="lazy"
                          className="mb-3 h-40 w-full rounded-lg object-cover"
                        />
                      )}
                      <SectionBody text={s.body} />
                    </div>
                  </details>
                ))}
                </div>
              </section>
            </div>
          );
        })}

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
