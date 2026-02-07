/**
 * Submits WhatsApp templates for Meta approval via Twilio Content API.
 * Run after create-whatsapp-templates.ts
 *
 * Usage: npx tsx scripts/submit-templates-approval.ts
 */

require('dotenv').config({ path: '.env.local' });

const SID = process.env.TWILIO_ACCOUNT_SID!;
const TOKEN = process.env.TWILIO_AUTH_TOKEN!;

const templates: Record<string, string> = {
  curatenie_test: 'HX350e3212b713bf2a7feba9b9e705cbde',
  curatenie_zilnic: 'HX47db3874dc9299d3cfa8afbba44bc16a',
  curatenie_modificare: 'HXd4af4b7bf54868eae9aa90035898ecb5',
  program_0: 'HX07a0e6c62869db7709ba9fbb0e31bca4',
  program_1: 'HX0faf74149f9d64e4b7bd70cbbc110fc2',
  program_2: 'HXafd4dcdeef84e6193498169635bf82b8',
  program_3: 'HXbd9291960dfa830c183ec4e9ed7f29c2',
  program_4: 'HXe1b3194e9c60cf424283bcb7e063ebca',
  program_5: 'HX8d1b6d73ca534eb6c7f6c85da0f69a46',
  program_6: 'HX828173c98d79fef1ed52703b5789baf9',
};

async function submitApproval(name: string, contentSid: string) {
  const url = `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`;
  const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64');

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify({
      name: name,
      category: 'UTILITY',
    }),
  });

  const data = await resp.json();
  if (resp.ok) {
    console.log(`${name}: submitted (status: ${(data as any).status || 'ok'})`);
  } else {
    console.error(`${name}: ERROR ${resp.status} - ${JSON.stringify(data)}`);
  }
}

async function main() {
  for (const [name, sid] of Object.entries(templates)) {
    await submitApproval(name, sid);
  }
  console.log('\nDone! Check approval status in Twilio Console -> Content Template Builder');
}

main();
