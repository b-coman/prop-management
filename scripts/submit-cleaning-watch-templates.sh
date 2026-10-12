#!/usr/bin/env bash
# Submits the cleaning watch's two WhatsApp templates to Meta for approval (UTILITY, ro), on the
# property's WhatsApp Business account. Run once: bash scripts/submit-cleaning-watch-templates.sh
#
# The names, the body wording and the button order must match src/services/cleaningWatchService.ts
# (QUESTION_TEMPLATE, INFO_TEMPLATE, buttons 0 = Da, 1 = Nu inca, 2 = the wa.me link).
# Meta usually answers within minutes to a few hours. Check with:
#   curl -s "https://graph.facebook.com/v21.0/$WABA/message_templates?fields=name,status,category" -H "Authorization: Bearer $TOKEN"
set -euo pipefail

WABA=1615836323304237
TOKEN=$(gcloud secrets versions access latest --secret=WHATSAPP_CLOUD_TOKEN | tr -d '\n')

submit() {
  curl -s -X POST "https://graph.facebook.com/v21.0/$WABA/message_templates" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-
  echo
}

submit <<'EOF'
{
  "name": "curatenie_verificare",
  "language": "ro",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Verificare curatenie pentru {{1}}:\n\n{{2}}\n\nTe rog sa raspunzi cu unul dintre butoanele de mai jos, ca sa stiu daca mai trebuie sa te anunt.",
      "example": { "body_text": [["Coltei", "Maine, Joi 22.10, sosesc 4 persoane pe la 21:00. Apartamentul e liber din Duminica 18.10 (check-out la 11:00). E gata curatenia?"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Da" },
        { "type": "QUICK_REPLY", "text": "Nu inca" },
        { "type": "URL", "text": "Scrie-i pe WhatsApp", "url": "https://prahova-chalet.ro/api/cleaning/wa/{{1}}", "example": ["https://prahova-chalet.ro/api/cleaning/wa/3f9a2c1b7d4e8a60b1c2d3e4"] }
      ]
    }
  ]
}
EOF

submit <<'EOF'
{
  "name": "notificare_curatenie",
  "language": "ro",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Notificare pentru {{1}}:\n\n{{2}}\n\nAcesta este un mesaj automat de la sistemul de rezervari, trimis doar proprietarului.",
      "example": { "body_text": [["Coltei", "Mihaela a fost la apartament Marti 20.10, intre 11:42 si 13:55 (2 ore 13 min). Urmatorii oaspeti: Joi 22.10, sosesc 4 persoane pe la 21:00."]] }
    }
  ]
}
EOF
