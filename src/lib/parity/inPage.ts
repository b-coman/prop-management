/**
 * The extractor, as a string of JavaScript to run INSIDE the page.
 *
 * Why this exists, and why it is not a duplicate by accident:
 *
 * The Chrome extension deliberately prevents a page's contents being shipped out in bulk — Blob
 * downloads get site-blocked, the clipboard needs a user gesture, base64 returns are refused outright
 * ("BLOCKED: Base64 encoded data"), and large plain-text returns are truncated. That is correct
 * security behaviour, and it means the design "browser captures raw text, Node parses it" cannot work.
 * The parsing has to happen where the text is, and only a small verdict may come back.
 *
 * So there are necessarily two implementations. The danger is that they drift, and a drifted pair is
 * worse than either alone: the tested one passes while the running one is wrong. `__tests__/inPage.test.ts`
 * exists solely to prevent that — it evaluates this string and asserts it agrees with `extract()` on
 * every fixture, including the live-page ones. If you change one, that test fails until you change both.
 *
 * The rules mirrored here, and the reason for each:
 *  - money parsing decides the decimal separator by DIGIT COUNT, not by symbol ("2,064" is 2064)
 *  - the charged price is the MINIMUM of the "… total" candidates (a discount is the lower of a pair)
 *  - the list price is sought ONLY in the ~140 chars before the total (the whole page is 10KB of
 *    unrelated figures, and scanning it invented a 64% discount on a live page)
 *  - counts are bounded and cannot begin mid-number (a date read as a guest count otherwise)
 *  - a page states its own outcome: bot-check / min-stay / no-availability / not-priced
 */
export const IN_PAGE_EXTRACTOR = String.raw`
function __money(raw){
  var c=raw.replace(/[^\d.,]/g,''); if(!c) return null;
  var ls=Math.max(c.lastIndexOf('.'),c.lastIndexOf(',')); var o;
  if(ls===-1){o=c;} else { var d=c.length-ls-1;
    o = d===3 ? c.replace(/[.,]/g,'') : c.slice(0,ls).replace(/[.,]/g,'')+'.'+c.slice(ls+1); }
  var n=Number(o); return isFinite(n)?n:null;
}
function __count(t,w){
  var m=t.match(new RegExp('(?:^|[^\\d/.,])(\\d{1,2})\\s+(?:'+w+')\\b','i'));
  return m?Number(m[1]):null;
}
function __panelGuests(t){
  // The booking panel's "GUESTS <n> guests", never the listing header's capacity line.
  var m=t.match(/guests?\s+(\d{1,2})\s+guests?\b/i);
  if(m) return Number(m[1]);
  return __count(t,'guests?|adults?|oaspe\\w*');
}
function __classify(t){
  var l=t.toLowerCase();
  if(!l.trim()||t.length<200) return 'not-loaded';
  if(/(are you a robot|unusual traffic|verify you are human|captcha|security check)/.test(l)) return 'bot-check';
  if(/(minimum stay|minimum-night stay|min\.? stay|stay of \d+ nights? or more|sejur minim|you need to stay \d+\+? nights?|add an extra night to your search)/.test(l)) return 'min-stay';
  if(/(no availability|not available for|sold out|dates are not available|nu este disponibil|unavailable for your dates)/.test(l)) return 'no-availability';
  if(/add dates for prices/.test(l)) return 'not-priced';
  return 'priced';
}
function __airbnb(t){
  var re=/([\d.,]+)\s*(RON|lei|€|EUR|\$|USD)\s*total/gi, tot=[], cur='RON', m;
  while((m=re.exec(t))!==null){ var v=__money(m[1]); if(v!==null&&v>0){ tot.push(v); cur=m[2]; } }
  if(!tot.length) return {state:'no-total'};
  // Dedupe: the same figure is rendered twice (panel + price breakdown), which is one price, not a pair.
  var uniq=tot.filter(function(v,i){return tot.indexOf(v)===i;}).sort(function(a,b){return a-b;});
  var total=uniq[0];
  var promo=/(host is offering a discount|special offer|reducere|price were changed)/i.test(t);
  var list = uniq.length>1 ? uniq[uniq.length-1] : null;
  if(list===null){
    var anchor=t.search(/[\d.,]+\s*(?:RON|lei|€|EUR|\$|USD)\s*total/i);
    if(anchor>-1){
      var before=t.slice(Math.max(0,anchor-140),anchor), nr=/([\d.,]+)\s*(?:RON|lei|€|EUR|\$|USD)/gi, m2;
      while((m2=nr.exec(before))!==null){ var v2=__money(m2[1]);
        if(v2!==null&&v2>total&&v2<total*3&&(list===null||v2>list)) list=v2; }
    }
  }
  return {state:'ok',total:total,list:list,currency:cur,promo:promo,plan:'flexible',
          nights:__count(t,'nights?\\s+in'),guests:__panelGuests(t)};
}
// How many people the page itself says were searched for. Booking prints "4 adults · 2 children ·
// 1 room", so the party never has to be threaded in from outside — and reading it here means the
// capacity filter and the echo check agree by construction.
function __bkNights(t){
  // Booking writes "1 week, 2 adults, 1 child" at exactly seven nights and never the word "night";
  // ten nights reads "10 nights". Anchored, and Booking-only: Airbnb pages say "2 weeks ago" in the
  // reviews. See readBookingNights() in extract.ts for the full story.
  var n=__count(t,'nights?')||__count(t,'nopt\\w*'); if(n) return n;
  var W='(?:weeks?|s[\u0103a]pt[\u0103a]m[\u00e2a]n[\u0103i]\\w*)';
  var m=t.match(new RegExp('\\b(\\d{1,2})\\s+'+W+'\\s*[,\u00b7]\\s*\\d{1,2}\\s*(?:adults?|adul[\u021bt]\\w*)','i'))
     || t.match(new RegExp('(?:price for|pre[\u021bt]\\w*\\s+pentru)\\s+(\\d{1,2})\\s+'+W+'\\b','i'));
  return m?Number(m[1])*7:null;
}
function __bookingWanted(t){
  var m=t.match(/(\d{1,2})\s*adults?\s*[·,]\s*(\d{1,2})\s*(?:children|child)/i);
  if(m) return Number(m[1])+Number(m[2]);
  m=t.match(/(\d{1,2})\s*adults?/i);
  return m?Number(m[1]):null;
}
function __booking(t){
  var cands=[], m;
  // Each rate row carries its own capacity, written EITHER as "Max persons: 4" (adults-only search)
  // OR as "Max adults: 4 <br> Max children: 2" (search including children). The in-page parser used
  // to have no capacity filter whatsoever, so it always returned the cheapest pair on the page — on
  // 2026-09-04 that was the "Max adults: 3" row at 1,840, banked as the price for a family of six
  // against a true 2,216, and it manufactured the whole +26/+31/+36% September panic.
  var caps=[], cr=/max\s*(?:persons?|adults?)\s*:?\s*(\d{1,2})(?:[^\d]{0,20}?max\s*children\s*:?\s*(\d{1,2}))?/gi;
  while((m=cr.exec(t))!==null){ caps.push({at:m.index, max:Number(m[1])+(m[2]===undefined?0:Number(m[2]))}); }
  var want=__bookingWanted(t);
  function capAt(i){ var b=null; for(var j=0;j<caps.length;j++) if(caps[j].at<=i) b=caps[j].max; return b; }
  var tooSmall=0;
  var pr=/original price[^\d]{0,20}([\d.,]+)[^\d]{0,40}?current price[^\d]{0,20}([\d.,]+)/gi;
  while((m=pr.exec(t))!==null){ var o=__money(m[1]), c=__money(m[2]);
    if(c===null||c<=0) continue;
    var cp=capAt(m.index);
    if(want&&cp!==null&&cp<want){ tooSmall++; continue; }
    cands.push({cur:c,orig:o}); }
  if(!cands.length&&tooSmall>0) return {state:'party-too-large'};
  // Priced rows but nothing saying who they seat: taking the minimum here is precisely the bug.
  if(want&&cands.length>1&&!caps.length) return {state:'ambiguous-capacity'};
  if(!cands.length){ var br=/(RON|lei)\s*([\d.,]+)/gi;
    while((m=br.exec(t))!==null){ var v=__money(m[2]); if(v!==null&&v>0) cands.push({cur:v,orig:null}); } }
  if(!cands.length) return {state:'no-total'};
  var best=cands[0]; for(var i=1;i<cands.length;i++) if(cands[i].cur<best.cur) best=cands[i];
  var nonRef=/(non-?refundable|nerambursabil|no refund)/i.test(t);
  var flex=/(free cancellation|fully refundable|anulare gratuit|rambursabil)/i.test(t);
  return {state:'ok',total:best.cur,list:best.orig,currency:'RON',
          promo:best.orig!==null&&best.orig>best.cur,
          plan: nonRef&&!flex ? 'non-refundable' : (flex?'flexible':'unknown'),
          nights:__bkNights(t),guests:__count(t,'adults?|guests?'),
          needsSignIn:/(sign in to unlock|members?-only price)/i.test(t)};
}
function __extract(channel,t){
  var st=__classify(t); if(st!=='priced') return {state:st};
  var r = channel==='airbnb' ? __airbnb(t) : __booking(t);
  if(r.state!=='ok') return r;
  // Same structural guards as the TS parser: a "discount" that is not a discount means the struck
  // original was captured as the charged price, and a promo with no pair means we cannot tell them apart.
  if(r.list!==null&&r.list<r.total) return {state:'inverted'};
  // A promo with no list price keeps the price and loses only the depth — see extract.ts.
  return r;
}
`;

/** Build the snippet that parses everything held in sessionStorage and returns a compact verdict list. */
export function inPageRunner(channel: 'airbnb' | 'booking.com', from: number, to: number): string {
  return `${IN_PAGE_EXTRACTOR}
var keys=Object.keys(sessionStorage).filter(function(k){return /^p\\d+$/.test(k);})
  .sort(function(a,b){return (+a.slice(1))-(+b.slice(1));}).slice(${from}, ${to});
keys.map(function(k){
  var t=sessionStorage.getItem(k), r=__extract('${channel}', t);
  // The window the list price was read from travels back too, so Node can re-derive the same numbers
  // and prove the two implementations still agree.
  var anchor=t.search(/[\\d.,]+\\s*(?:RON|lei)\\s*total/i);
  var win = anchor>-1 ? t.slice(Math.max(0,anchor-90), anchor+30).replace(/\\s+/g,' ') : '';
  return [k.slice(1), r.state, r.total||'', r.list||'', r.promo?'P':'-', r.nights||'', r.guests||'', r.plan||'', win].join('~');
}).join('\\n');`;
}
