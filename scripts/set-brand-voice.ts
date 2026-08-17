#!/usr/bin/env npx tsx
/**
 * set-brand-voice — write the owner's voice guide onto a property.
 *
 * Read by the ad copywriter on every generation (`adPlannerPack` → `pack.voice` →
 * `generateAdCreative`), so the copy arrives in the owner's voice instead of being corrected into it
 * by hand afterwards. Lives in Firestore rather than in the prompt so it can be tuned without a
 * deploy, and per-property because a mountain chalet and a city apartment do not share a voice.
 *
 * EVERYTHING BELOW IS EVIDENCE, NOT INVENTION. Every `good` line is one the owner wrote or approved
 * on 2026-08-17; every `avoid` pair is a correction he actually made that day. That matters: a model
 * matches a demonstrated sentence far more reliably than it follows an adjective like "warm", and
 * before/after pairs are what stop a habit coming back.
 *
 * Usage:
 *   npx tsx scripts/set-brand-voice.ts                 # dry run
 *   npx tsx scripts/set-brand-voice.ts --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { BrandVoice } from '@/types';

const P = process.argv.find((a) => a.startsWith('--property='))?.split('=')[1] ?? 'prahova-mountain-chalet';
const APPLY = process.argv.includes('--apply');

const VOICE: BrandVoice = {
  language: 'ro',
  principles: [
    'Scrie substantive concrete, nu adjective. Lucruri care se văd, se aud sau se mănâncă: vinete, jar, ceaun, zacuscă, veverițe, lemne de foc, fibră optică. "Liniște deplină" nu convinge pe nimeni; "ciripit de păsărele" da.',
    'Spune numele locurilor reale: Comarnic, Bucegi, Valea Prahovei, Peleș, Sinaia. Nu "la munte" în general, când poți spune unde.',
    'Propoziții scurte, declarative. Fără introduceri, fără crescendo, fără semne de exclamare.',
    'Fără cifre și procente în textul emoțional. Prețurile și reducerile stau în linia de ofertă, nu în poveste.',
    'Româneasca vorbită, niciodată tradusă din engleză. Un buton spune "Rezervă", nu "Rezervă acesta".',
    'Răspunde obiecției, nu enumera facilități. "Nu e nevoie să îți iei concediu" vinde mai mult decât "internet de mare viteză".',
    'Taie cuvintele care nu duc greutate: "Un weekend prelungit" → "Weekend prelungit"; "cel mai bun preț direct" → "cel mai bun preț".',
    'Ton cald și sec, cu umor discret. Niciodată entuziast, niciodată de agent de vânzări.',
    'Persoana a doua, singular, informal: "Ai terasă acoperită", "Lucrează de aici", "Ia-ți laptopul". Niciodată "dumneavoastră".',
    'Diacritice corecte, întotdeauna: și, ă, â, î, ș, ț.',
    'Niciodată liniuță lungă sau linie de dialog (— sau –). Folosește cratima simplă (-) sau reformulează propoziția. Regulă fermă a proprietarului.',
  ],
  good: [
    'Vinete pe jar și zacuscă la ceaun',
    'La o oră de București. În oraș e tot cald, copiii s-au întors la școală, iar liniștea s-a așternut peste Bucegi și Valea Prahovei.',
    'Septembrie e perioada perfectă',
    'Nu e nevoie să îți iei concediu, avem internet la discreție',
    'Ai terasă acoperită, veverițe, ciripit de păsărele și internet prin fibră optică. Mijlocul de săptămână, în septembrie, e cel mai liniștit din an aici. Iar lemnele de foc le ai din partea casei.',
    'La birou, cu veverițe',
    'Liniște și munte, la job',
    'Toamna pe jar, la munte',
    'Weekend prelungit, început de septembrie',
    'Te așteptăm la Comarnic',
  ],
  avoid: [
    '"în munte" → "la munte" (forma firească în română)',
    '"Rezervă acesta" → "Rezervă" (calc după "Book this"; româna nu pune pronumele pe buton)',
    '"Biroul cu vedere la veverițe" → "La birou, cu veverițe" (mai scurt, mai jucăuș)',
    '"Rezervă direct și plătești cu 10-13% mai puțin" → "Rezervă direct și plătești mai puțin" (fără procente în textul emoțional)',
    '"Direct 10-13% sub Airbnb și Booking" → nu numi concurența și nu promite o cifră care depinde de reducerile lor',
    '"cel mai bun preț direct" → "cel mai bun preț"',
    '"Te așteptăm la munte" → "Te așteptăm la Comarnic" (numește locul)',
    '"Un weekend prelungit" → "Weekend prelungit"',
    '"O jumătate de săptămână aici costă mai puțin decât crezi" → pornește de la obiecție, nu de la preț',
  ],
  notes:
    'Publicul: adulți din București și Ploiești, fără copii în campaniile de toamnă. Casa se vinde prin mâncare gătită afară, foc seara și liniște — nu prin facilități. Reducerile reale: 3 nopți -10%, 4 nopți -15%, 7 nopți -25%. Lemnele de foc sunt incluse și internetul e pe fibră (confirmat de proprietar, 2026-08-17).',
};

(async () => {
  const db = await getAdminDb();
  const ref = db.collection('properties').doc(P);
  const snap = await ref.get();
  if (!snap.exists) { console.error(`property ${P} not found`); process.exit(1); }
  const before = (snap.data() as any).brandVoice as BrandVoice | undefined;

  console.log(`\n=== brandVoice — ${P} ===`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}   (currently ${before ? 'set' : 'not set'})\n`);
  console.log(`  language   : ${VOICE.language}`);
  console.log(`  principles : ${VOICE.principles.length}`);
  console.log(`  good       : ${VOICE.good.length} lines the owner wrote or approved`);
  console.log(`  avoid      : ${VOICE.avoid.length} corrections he actually made`);
  if (!APPLY) { console.log('\n  dry run; re-run with --apply'); process.exit(0); }

  // Field-level update — never .set() a whole property document.
  await ref.update({ brandVoice: VOICE });
  const after = ((await ref.get()).data() as any).brandVoice as BrandVoice;
  console.log(`\n  written: ${after.principles.length} principles · ${after.good.length} good · ${after.avoid.length} avoid`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
