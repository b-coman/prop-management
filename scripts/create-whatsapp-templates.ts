/**
 * Creates WhatsApp message templates via Twilio Content API
 * and submits them for Meta approval.
 *
 * Usage: npx tsx scripts/create-whatsapp-templates.ts [--delete-old]
 */

require('dotenv').config({ path: '.env.local' });
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const SID = process.env.TWILIO_ACCOUNT_SID!;
const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64');

// Old template SIDs to delete (from first rejected batch)
const oldSids = [
  'HX350e3212b713bf2a7feba9b9e705cbde',
  'HX47db3874dc9299d3cfa8afbba44bc16a',
  'HXd4af4b7bf54868eae9aa90035898ecb5',
  'HX07a0e6c62869db7709ba9fbb0e31bca4',
  'HX0faf74149f9d64e4b7bd70cbbc110fc2',
  'HXafd4dcdeef84e6193498169635bf82b8',
  'HXbd9291960dfa830c183ec4e9ed7f29c2',
  'HXe1b3194e9c60cf424283bcb7e063ebca',
  'HX8d1b6d73ca534eb6c7f6c85da0f69a46',
  'HX828173c98d79fef1ed52703b5789baf9',
];

// New templates with more static text to satisfy Meta's variable-to-word ratio
const templates = [
  {
    name: "curatenie_test",
    body: "Buna, {{1}}! Acesta este un mesaj de test trimis de la proprietatea {{2}} prin sistemul de notificari RentSpot. Daca ai primit acest mesaj, notificarile WhatsApp functioneaza corect!",
    variables: { "1": "Maria", "2": "Vila Prahova" }
  },
  {
    name: "curatenie_zilnic",
    body: "Buna, {{1}}! Ai o notificare noua de la proprietatea {{2}}. Iata detaliile pentru azi:\n\n{{3}}\n\nIti dorim o zi buna si lucru usor!",
    variables: { "1": "Maria", "2": "Vila Prahova", "3": "Azi, 15.02 vine Ana Ionescu (2 adulti, 1 copil), pana pe 18.02." }
  },
  {
    name: "curatenie_modificare",
    body: "Buna, {{1}}! Ai o notificare importanta de la proprietatea {{2}}. S-a modificat programul de rezervari:\n\n{{3}}\n\nProgramul actualizat va fi trimis separat. Multumim!",
    variables: { "1": "Maria", "2": "Vila Prahova", "3": "Rezervare noua - Ion Popescu, 15.02-18.02 (2 adulti, 1 copil)." }
  },
  {
    name: "program_0",
    body: "Buna, {{1}}! Iata situatia rezervarilor la proprietatea {{2}} pentru luna {{3}}.\n\nNu sunt rezervari confirmate in aceasta luna.\n\nO luna usoara! Daca apar modificari, vei fi anuntata.",
    variables: { "1": "Maria", "2": "Vila Prahova", "3": "martie" }
  },
  {
    name: "program_1",
    body: "Buna, {{1}}! Iata programul de curatenie la proprietatea {{2}} pentru luna {{3}}. Mai jos sunt rezervarile confirmate:\n\n{{4}}\n- {{5}}\n\nDaca aveti intrebari sau modificari, va rugam sa ne anuntati. Multumim!",
    variables: {
      "1": "Maria", "2": "Vila Prahova", "3": "februarie",
      "4": "In prezent, Ion Popescu este cazat pana pe 05.02.",
      "5": "12.02-15.02 Ana Ionescu (2 adulti)"
    }
  },
  {
    name: "program_2",
    body: "Buna, {{1}}! Iata programul de curatenie la proprietatea {{2}} pentru luna {{3}}. Mai jos sunt rezervarile confirmate:\n\n{{4}}\n- {{5}}\n- {{6}}\n\nDaca aveti intrebari sau modificari, va rugam sa ne anuntati. Multumim!",
    variables: {
      "1": "Maria", "2": "Vila Prahova", "3": "februarie",
      "4": "In prezent, Ion Popescu este cazat pana pe 05.02.",
      "5": "12.02-15.02 Ana Ionescu (2 adulti)",
      "6": "22.02-25.02 Mihai Radu (3 adulti, 1 copil)"
    }
  },
  {
    name: "program_3",
    body: "Buna, {{1}}! Iata programul de curatenie la proprietatea {{2}} pentru luna {{3}}. Mai jos sunt toate rezervarile confirmate:\n\n{{4}}\n- {{5}}\n- {{6}}\n- {{7}}\n\nDaca aveti intrebari sau modificari, va rugam sa ne anuntati. Va multumim!",
    variables: {
      "1": "Maria", "2": "Vila Prahova", "3": "februarie",
      "4": "In prezent, Ion Popescu este cazat pana pe 05.02.",
      "5": "05.02-08.02 Ana Ionescu (2 adulti)",
      "6": "12.02-15.02 Mihai Radu (3 adulti)",
      "7": "22.02-25.02 Elena Voicu (2 adulti, 1 copil)"
    }
  },
  {
    name: "program_4",
    body: "Buna, {{1}}! Iata programul de curatenie la proprietatea {{2}} pentru luna {{3}}. Mai jos sunt toate rezervarile confirmate pentru aceasta luna:\n\n{{4}}\n- {{5}}\n- {{6}}\n- {{7}}\n- {{8}}\n\nDaca aveti intrebari sau modificari, va rugam sa ne anuntati. Va multumim pentru colaborare!",
    variables: {
      "1": "Maria", "2": "Vila Prahova", "3": "februarie",
      "4": "In prezent, Ion Popescu este cazat pana pe 05.02.",
      "5": "05.02-08.02 Ana Ionescu (2 adulti)",
      "6": "12.02-15.02 Mihai Radu (3 adulti)",
      "7": "18.02-21.02 Elena Voicu (2 adulti, 1 copil)",
      "8": "25.02-28.02 Dan Marin (4 adulti)"
    }
  },
  {
    name: "program_5",
    body: "Buna, {{1}}! Iata programul complet de curatenie la proprietatea {{2}} pentru luna {{3}}. Mai jos sunt toate rezervarile confirmate pentru aceasta luna:\n\n{{4}}\n- {{5}}\n- {{6}}\n- {{7}}\n- {{8}}\n- {{9}}\n\nDaca aveti intrebari sau modificari, va rugam sa ne anuntati. Va multumim foarte mult pentru colaborare!",
    variables: {
      "1": "Maria", "2": "Vila Prahova", "3": "februarie",
      "4": "In prezent, Ion Popescu este cazat pana pe 05.02.",
      "5": "05.02-08.02 Ana Ionescu (2 adulti)",
      "6": "10.02-13.02 Mihai Radu (3 adulti)",
      "7": "15.02-18.02 Elena Voicu (2 adulti)",
      "8": "20.02-23.02 Dan Marin (4 adulti)",
      "9": "26.02-28.02 Sofia Popa (2 adulti, 2 copii)"
    }
  },
  {
    name: "program_6",
    body: "Buna, {{1}}! Iata programul complet de curatenie la proprietatea {{2}} pentru luna {{3}}. Mai jos sunt toate rezervarile confirmate pentru aceasta luna si detaliile fiecarei rezervari:\n\n{{4}}\n- {{5}}\n- {{6}}\n- {{7}}\n- {{8}}\n- {{9}}\n- {{10}}\n\nDaca aveti intrebari sau modificari, va rugam sa ne anuntati. Va multumim foarte mult pentru colaborare!",
    variables: {
      "1": "Maria", "2": "Vila Prahova", "3": "august",
      "4": "In prezent, Ion Popescu este cazat pana pe 03.08.",
      "5": "05.08-08.08 Ana Ionescu (2 adulti)",
      "6": "10.08-14.08 Mihai Radu (4 adulti, 2 copii)",
      "7": "16.08-18.08 Elena Voicu (2 adulti)",
      "8": "20.08-23.08 Dan Marin (3 adulti, 1 copil)",
      "9": "25.08-28.08 Sofia Popa (2 adulti)",
      "10": "30.08-02.09 Andrei Luca (2 adulti, 2 copii)"
    }
  },
];

async function deleteOld() {
  console.log('Deleting old templates...');
  for (const sid of oldSids) {
    try {
      const resp = await fetch(`https://content.twilio.com/v1/Content/${sid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${auth}` },
      });
      console.log(`  ${sid}: ${resp.status === 204 ? 'deleted' : `status ${resp.status}`}`);
    } catch (err: any) {
      console.log(`  ${sid}: ${err.message}`);
    }
  }
  console.log('');
}

async function createAndSubmit(t: typeof templates[0]) {
  try {
    const content = await (client as any).content.v1.contents.create({
      friendlyName: t.name,
      language: 'ro',
      variables: t.variables,
      types: {
        'twilio/text': { body: t.body }
      }
    });
    console.log(`${t.name}: SID=${content.sid}`);

    // Submit for approval via REST API
    const resp = await fetch(
      `https://content.twilio.com/v1/Content/${content.sid}/ApprovalRequests/whatsapp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({ name: t.name, category: 'UTILITY' }),
      }
    );
    const data: any = await resp.json();
    console.log(`  -> Approval: ${data.status || JSON.stringify(data)}`);

    return content.sid;
  } catch (err: any) {
    console.error(`${t.name}: ERROR - ${err.message}`);
    return null;
  }
}

async function main() {
  // Delete old templates first
  await deleteOld();

  // Create new ones
  const results: Record<string, string | null> = {};
  for (const t of templates) {
    results[t.name] = await createAndSubmit(t);
  }
  console.log('\n=== SUMMARY ===');
  for (const [name, sid] of Object.entries(results)) {
    console.log(`${name}: ${sid || 'FAILED'}`);
  }
}

main();
