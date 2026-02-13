#!/usr/bin/env node

/**
 * Upload legal pages (Privacy Policy + Terms of Service) to Firestore.
 *
 * Updates:
 *   1. websiteTemplates/holiday-house — adds page definitions via dot-notation update()
 *   2. propertyOverrides/{slug} — adds page content with set({ merge: true })
 *      and adds page names to visiblePages via FieldValue.arrayUnion()
 *
 * Usage:
 *   npx tsx scripts/upload-legal-pages.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Error: FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH environment variable not set');
  process.exit(1);
}

const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------- Template page definitions ----------

const privacyPolicyPage = {
  path: '/privacy-policy',
  title: { en: 'Privacy Policy', ro: 'Politica de Confidențialitate' },
  blocks: [
    { id: 'legal-content', type: 'legalContent' },
  ],
};

const termsOfServicePage = {
  path: '/terms-of-service',
  title: { en: 'Terms of Service', ro: 'Termeni și Condiții' },
  blocks: [
    { id: 'legal-content', type: 'legalContent' },
  ],
};

// ---------- Privacy Policy content ----------

const privacyPolicyContent = {
  'legal-content': {
    title: { en: 'Privacy Policy', ro: 'Politica de Confidențialitate' },
    lastUpdated: '2026-02-13',
    sections: [
      {
        title: { en: '1. Introduction', ro: '1. Introducere' },
        body: {
          en: 'This Privacy Policy explains how we collect, use, and protect your personal information when you use our vacation rental booking platform. By using our website, you agree to the practices described in this policy.',
          ro: 'Această Politică de Confidențialitate explică modul în care colectăm, folosim și protejăm informațiile dumneavoastră personale atunci când utilizați platforma noastră de rezervări pentru cazare de vacanță. Prin utilizarea site-ului nostru, sunteți de acord cu practicile descrise în această politică.',
        },
      },
      {
        title: { en: '2. Data We Collect', ro: '2. Datele pe care le colectăm' },
        body: {
          en: 'We collect the following personal data when you make a booking or interact with our website:\n\n- Full name (first and last name)\n- Email address\n- Phone number (optional)\n- Booking details (dates, number of guests, special requests)\n- Payment information (processed securely by Stripe — we do not store card details)\n- Cookies and usage data (see Section 5)',
          ro: 'Colectăm următoarele date personale atunci când efectuați o rezervare sau interacționați cu site-ul nostru:\n\n- Numele complet (prenume și nume)\n- Adresa de email\n- Numărul de telefon (opțional)\n- Detalii rezervare (date, număr de oaspeți, cereri speciale)\n- Informații de plată (procesate securizat de Stripe — nu stocăm detalii despre card)\n- Cookie-uri și date de utilizare (vezi Secțiunea 5)',
        },
      },
      {
        title: { en: '3. How We Use Your Data', ro: '3. Cum folosim datele dumneavoastră' },
        body: {
          en: 'Your personal data is used for the following purposes:\n\n- Processing and confirming your booking\n- Communicating with you about your reservation (confirmation emails, check-in instructions)\n- Sending housekeeping notifications related to your stay\n- Improving our website and services through analytics\n- Complying with legal obligations',
          ro: 'Datele dumneavoastră personale sunt utilizate în următoarele scopuri:\n\n- Procesarea și confirmarea rezervării\n- Comunicarea cu dumneavoastră despre rezervare (e-mailuri de confirmare, instrucțiuni de check-in)\n- Trimiterea notificărilor de menaj legate de sejurul dumneavoastră\n- Îmbunătățirea site-ului și serviciilor noastre prin analiză\n- Respectarea obligațiilor legale',
        },
      },
      {
        title: { en: '4. Third-Party Services', ro: '4. Servicii terțe' },
        body: {
          en: 'We use the following third-party services that may process your data:\n\n- Stripe: For secure payment processing. Stripe\'s privacy policy applies to payment data.\n- Google Analytics: For understanding website usage patterns. Data is anonymized where possible.\n- Firebase: For storing booking and property data securely on Google Cloud infrastructure.',
          ro: 'Utilizăm următoarele servicii terțe care pot prelucra datele dumneavoastră:\n\n- Stripe: Pentru procesarea securizată a plăților. Politica de confidențialitate Stripe se aplică datelor de plată.\n- Google Analytics: Pentru înțelegerea modelelor de utilizare a site-ului. Datele sunt anonimizate unde este posibil.\n- Firebase: Pentru stocarea securizată a datelor de rezervare și proprietăți pe infrastructura Google Cloud.',
        },
      },
      {
        title: { en: '5. Cookies', ro: '5. Cookie-uri' },
        body: {
          en: 'Our website uses the following categories of cookies:\n\n- Necessary cookies: Required for the website to function (session management, security). Cannot be disabled.\n- Analytics cookies: Help us understand how visitors use our website (Google Analytics). Can be disabled via cookie preferences.\n- Marketing cookies: Used to measure advertising effectiveness. Can be disabled via cookie preferences.\n\nYou can manage your cookie preferences at any time using the "Cookie Settings" link in the footer.',
          ro: 'Site-ul nostru folosește următoarele categorii de cookie-uri:\n\n- Cookie-uri necesare: Necesare pentru funcționarea site-ului (gestionarea sesiunii, securitate). Nu pot fi dezactivate.\n- Cookie-uri analitice: Ne ajută să înțelegem cum folosesc vizitatorii site-ul (Google Analytics). Pot fi dezactivate din preferințele cookie.\n- Cookie-uri de marketing: Folosite pentru măsurarea eficienței publicității. Pot fi dezactivate din preferințele cookie.\n\nPuteți gestiona preferințele cookie oricând folosind linkul "Setări Cookie" din subsolul paginii.',
        },
      },
      {
        title: { en: '6. Your Rights (GDPR)', ro: '6. Drepturile dumneavoastră (GDPR)' },
        body: {
          en: 'Under the General Data Protection Regulation (GDPR), you have the following rights:\n\n- Right of access: Request a copy of the personal data we hold about you.\n- Right to rectification: Request correction of inaccurate personal data.\n- Right to erasure: Request deletion of your personal data (subject to legal retention requirements).\n- Right to data portability: Request your data in a structured, machine-readable format.\n- Right to object: Object to the processing of your personal data for specific purposes.\n- Right to withdraw consent: Withdraw consent for data processing at any time.\n\nTo exercise any of these rights, please contact us using the information in Section 8.',
          ro: 'Conform Regulamentului General privind Protecția Datelor (GDPR), aveți următoarele drepturi:\n\n- Dreptul de acces: Solicitați o copie a datelor personale pe care le deținem despre dumneavoastră.\n- Dreptul la rectificare: Solicitați corectarea datelor personale inexacte.\n- Dreptul la ștergere: Solicitați ștergerea datelor personale (sub rezerva cerințelor legale de păstrare).\n- Dreptul la portabilitatea datelor: Solicitați datele într-un format structurat, care poate fi citit automat.\n- Dreptul la opoziție: Opuneți-vă prelucrării datelor personale în scopuri specifice.\n- Dreptul de retragere a consimțământului: Retrageți consimțământul pentru prelucrarea datelor în orice moment.\n\nPentru a exercita oricare dintre aceste drepturi, vă rugăm să ne contactați folosind informațiile din Secțiunea 8.',
        },
      },
      {
        title: { en: '7. Data Retention', ro: '7. Păstrarea datelor' },
        body: {
          en: 'We retain your personal data for the following periods:\n\n- Booking data: 5 years after checkout, as required by Romanian fiscal regulations.\n- Communication records: 2 years after the last interaction.\n- Analytics data: Anonymized and retained indefinitely.\n- Cookie consent records: Retained for the duration of your consent (up to 1 year).\n\nAfter these periods, data is securely deleted or anonymized.',
          ro: 'Păstrăm datele dumneavoastră personale pentru următoarele perioade:\n\n- Date de rezervare: 5 ani după checkout, conform reglementărilor fiscale din România.\n- Înregistrări de comunicare: 2 ani după ultima interacțiune.\n- Date analitice: Anonimizate și păstrate pe termen nedeterminat.\n- Înregistrări de consimțământ cookie: Păstrate pe durata consimțământului (până la 1 an).\n\nDupă aceste perioade, datele sunt șterse sau anonimizate în mod securizat.',
        },
      },
      {
        title: { en: '8. Contact', ro: '8. Contact' },
        body: {
          en: 'For any questions about this Privacy Policy or to exercise your data protection rights, please contact us:\n\nEmail: The email address listed in the footer of this website.\n\nWe will respond to your request within 30 days.',
          ro: 'Pentru orice întrebări despre această Politică de Confidențialitate sau pentru a vă exercita drepturile de protecție a datelor, vă rugăm să ne contactați:\n\nEmail: Adresa de email listată în subsolul acestui site.\n\nVom răspunde solicitării dumneavoastră în termen de 30 de zile.',
        },
      },
    ],
  },
};

// ---------- Terms of Service content ----------

const termsOfServiceContent = {
  'legal-content': {
    title: { en: 'Terms of Service', ro: 'Termeni și Condiții' },
    lastUpdated: '2026-02-13',
    sections: [
      {
        title: { en: '1. Introduction', ro: '1. Introducere' },
        body: {
          en: 'By accessing and using this website to browse property information or make bookings, you accept and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use our website.',
          ro: 'Prin accesarea și utilizarea acestui site web pentru a vizualiza informații despre proprietăți sau pentru a face rezervări, acceptați și sunteți de acord să respectați acești Termeni și Condiții. Dacă nu sunteți de acord cu vreo parte a acestor termeni, vă rugăm să nu utilizați site-ul nostru.',
        },
      },
      {
        title: { en: '2. Booking Terms', ro: '2. Termenii rezervării' },
        body: {
          en: 'When you make a booking through our platform:\n\n- A booking is confirmed only after successful payment processing.\n- You must provide accurate personal information (name, email, phone number).\n- Minimum stay requirements vary by season and are displayed during the booking process.\n- Bookings are subject to availability and may be held temporarily before payment.',
          ro: 'Când efectuați o rezervare prin platforma noastră:\n\n- O rezervare este confirmată doar după procesarea cu succes a plății.\n- Trebuie să furnizați informații personale corecte (nume, email, număr de telefon).\n- Cerințele de sejur minim variază în funcție de sezon și sunt afișate în timpul procesului de rezervare.\n- Rezervările sunt supuse disponibilității și pot fi ținute temporar înainte de plată.',
        },
      },
      {
        title: { en: '3. Payments', ro: '3. Plăți' },
        body: {
          en: 'All payments are processed securely through Stripe:\n\n- Prices are displayed in Romanian Lei (RON).\n- The total price includes accommodation, cleaning fee, and applicable taxes.\n- Payment is required at the time of booking unless a date hold option is selected.\n- Date holds require a holding fee, which may be refundable upon completing the full booking.',
          ro: 'Toate plățile sunt procesate securizat prin Stripe:\n\n- Prețurile sunt afișate în Lei românești (RON).\n- Prețul total include cazarea, taxa de curățenie și taxele aplicabile.\n- Plata este necesară la momentul rezervării, cu excepția cazului în care este selectată opțiunea de blocare a datelor.\n- Blocarea datelor necesită o taxă de blocare, care poate fi rambursabilă la finalizarea rezervării complete.',
        },
      },
      {
        title: { en: '4. Cancellation', ro: '4. Anulare' },
        body: {
          en: 'Cancellation policies are specific to each property and are displayed on the booking page. Please review the cancellation policy carefully before completing your reservation. Refunds are processed through the original payment method.',
          ro: 'Politicile de anulare sunt specifice fiecărei proprietăți și sunt afișate pe pagina de rezervare. Vă rugăm să revizuiți cu atenție politica de anulare înainte de a finaliza rezervarea. Rambursările sunt procesate prin metoda de plată originală.',
        },
      },
      {
        title: { en: '5. Guest Responsibilities', ro: '5. Responsabilitățile oaspetelui' },
        body: {
          en: 'As a guest, you agree to:\n\n- Treat the property with care and respect.\n- Follow all house rules provided by the property owner.\n- Not exceed the maximum number of guests specified in your booking.\n- Report any damage or issues to the property owner promptly.\n- Leave the property in a reasonable condition at checkout.\n- Not engage in any illegal activities on the premises.\n\nYou may be held liable for any damage caused during your stay beyond normal wear and tear.',
          ro: 'Ca oaspete, sunteți de acord să:\n\n- Tratați proprietatea cu grijă și respect.\n- Respectați toate regulile casei furnizate de proprietar.\n- Nu depășiți numărul maxim de oaspeți specificat în rezervare.\n- Raportați prompt orice daune sau probleme proprietarului.\n- Lăsați proprietatea într-o stare rezonabilă la checkout.\n- Nu desfășurați activități ilegale în incintă.\n\nPuteți fi tras la răspundere pentru orice daune cauzate în timpul sejurului, dincolo de uzura normală.',
        },
      },
      {
        title: { en: '6. Liability', ro: '6. Răspundere' },
        body: {
          en: 'We strive to ensure all property information is accurate, but:\n\n- We are not liable for minor discrepancies between listed descriptions and actual conditions.\n- We are not responsible for events beyond our control (force majeure), including natural disasters, government actions, or utility failures.\n- Our total liability is limited to the amount paid for your booking.\n- We recommend guests obtain travel insurance for their protection.',
          ro: 'Ne străduim să ne asigurăm că toate informațiile despre proprietăți sunt corecte, dar:\n\n- Nu suntem răspunzători pentru discrepanțe minore între descrierile listate și condițiile reale.\n- Nu suntem responsabili pentru evenimente în afara controlului nostru (forță majoră), inclusiv dezastre naturale, acțiuni guvernamentale sau defecțiuni ale utilităților.\n- Răspunderea noastră totală este limitată la suma plătită pentru rezervare.\n- Recomandăm oaspeților să obțină o asigurare de călătorie pentru protecția lor.',
        },
      },
      {
        title: { en: '7. Intellectual Property', ro: '7. Proprietate intelectuală' },
        body: {
          en: 'All content on this website, including text, photographs, graphics, logos, and design elements, is the property of the website operator or used with permission. You may not reproduce, distribute, or use this content without prior written consent.',
          ro: 'Tot conținutul de pe acest site, inclusiv textele, fotografiile, grafica, logo-urile și elementele de design, este proprietatea operatorului site-ului sau este utilizat cu permisiune. Nu puteți reproduce, distribui sau utiliza acest conținut fără consimțământul scris prealabil.',
        },
      },
      {
        title: { en: '8. Governing Law', ro: '8. Legea aplicabilă' },
        body: {
          en: 'These Terms of Service are governed by the laws of Romania. Any disputes arising from the use of this website or bookings made through it shall be resolved in the competent courts of Romania.',
          ro: 'Acești Termeni și Condiții sunt guvernați de legile din România. Orice dispute care decurg din utilizarea acestui site sau din rezervările efectuate prin intermediul acestuia vor fi soluționate de instanțele competente din România.',
        },
      },
      {
        title: { en: '9. Changes to Terms', ro: '9. Modificări ale termenilor' },
        body: {
          en: 'We reserve the right to update these Terms of Service at any time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the website after changes constitutes acceptance of the revised terms.',
          ro: 'Ne rezervăm dreptul de a actualiza acești Termeni și Condiții în orice moment. Modificările vor fi publicate pe această pagină cu o dată actualizată "Ultima actualizare". Continuarea utilizării site-ului după modificări constituie acceptarea termenilor revizuiți.',
        },
      },
    ],
  },
};

// ---------- Property slugs ----------

const propertySlugs = [
  'prahova-mountain-chalet',
  'coltei-apartment-bucharest',
];

async function main() {
  const templateRef = db.collection('websiteTemplates').doc('holiday-house');

  // 1. Add page definitions to template using dot-notation update (non-destructive)
  console.log('Updating websiteTemplates/holiday-house with legal page definitions...');
  await templateRef.update({
    'pages.privacy-policy': privacyPolicyPage,
    'pages.terms-of-service': termsOfServicePage,
  });
  console.log('  Template pages added.');

  // 2. For each property, add content overrides and update visiblePages
  for (const slug of propertySlugs) {
    const overridesRef = db.collection('propertyOverrides').doc(slug);

    console.log(`\nUpdating propertyOverrides/${slug}...`);

    // Add page content using merge (non-destructive)
    await overridesRef.set(
      {
        'privacy-policy': privacyPolicyContent,
        'terms-of-service': termsOfServiceContent,
      },
      { merge: true },
    );
    console.log('  Legal page content added.');

    // Add to visiblePages array (idempotent — arrayUnion ignores duplicates)
    await overridesRef.update({
      visiblePages: FieldValue.arrayUnion('privacy-policy', 'terms-of-service'),
    });
    console.log('  visiblePages updated.');
  }

  console.log('\nDone! Legal pages uploaded successfully.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
