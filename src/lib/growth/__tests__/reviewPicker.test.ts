/** @jest-environment node */
import { detectLanguage, pickReview, usableReviews, type ReviewRow } from '../reviewPicker';

const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: 'r1', author: 'Ana', rating: 5, source: 'airbnb', at: Math.floor(Date.now() / 1000),
  text: 'Am petrecut un weekend minunat in locatia lui Bogdan. Casuta e izolata, inconjurata de natura si foarte bine amenajata. Recomand cu drag!',
  ...over,
});

describe('detectLanguage', () => {
  it('recognises Romanian typed without diacritics', () => {
    expect(detectLanguage(row().text)).toEqual({ lang: 'ro', confident: true });
  });

  it('recognises Romanian typed with diacritics', () => {
    const r = detectLanguage('Astăzi m-am întors dintr-o excursie în această casă magnifică. Liniște deplină și foarte frumos amenajată.');
    expect(r).toEqual({ lang: 'ro', confident: true });
  });

  it('recognises scripts outright', () => {
    expect(detectLanguage('הבית היה מקסים, נקי וענה על כל הציפיות שלנו מאוד').lang).toBe('he');
    expect(detectLanguage('Всё было идеально, дом очень чистый и уютный, спасибо').lang).toBe('ru');
  });

  // The real corpus is mostly English, and "casa" alone must never decide between ro/es/it.
  it('does not mistake Spanish for Romanian', () => {
    const r = detectLanguage('Bonita casa con todo los necesario para sentirte como en casa. Sofá enorme y muy agradable para todo.');
    expect(r.lang).not.toBe('ro');
  });

  it('refuses to guess on a short, thin text — silence is free, a wrong claim is not', () => {
    expect(detectLanguage('Great place to relax').confident).toBe(false);
    expect(detectLanguage('').confident).toBe(false);
  });
});

describe('usableReviews', () => {
  it('drops ratings-only, low scores and one-liners', () => {
    const rows = [
      row({ id: 'ok' }),
      row({ id: 'short', text: 'Superb!' }),
      row({ id: 'rated', text: '(Rating only)' }),
      row({ id: 'low', rating: 3 }),
    ];
    expect(usableReviews(rows).map((r) => r.id)).toEqual(['ok']);
  });
});

describe('pickReview', () => {
  const ro = row({ id: 'ro' });
  const en = row({ id: 'en', author: 'John', text: 'This place is amazing, the best stay we ever had. The house itself is beautiful and the garden was perfect for the kids.' });

  it('prefers a Romanian review over one it would have to translate', () => {
    expect(pickReview([en, ro])?.id).toBe('ro');
  });

  it('marks a non-Romanian pick for translation and names its language', () => {
    const p = pickReview([en])!;
    expect(p.needsTranslation).toBe(true);
    expect(p.langNameRo).toBe('engleză');
  });

  it('never repeats a review that has already been quoted', () => {
    expect(pickReview([ro], { usedReviewIds: ['ro'] })).toBeNull();
  });

  // A 120-character review has a verdict, not a part that carries a feeling — and the brief asks the
  // writer to quote the feeling.
  it('prefers the review with something to quote over the merely recent one', () => {
    // Both real, from the live corpus: Robert's is newer but 123 characters of verdict; Iryna's is a
    // year older and actually describes being there.
    const thin = row({ id: 'thin', author: 'Robert', at: Math.floor(Date.now() / 1000), text: 'Locul este potrivit pentru liniste si relaxare. Usor de ajuns la locatie si ai la indemana tot ceea ce ai nevoie. Recomand!' });
    const rich = row({
      id: 'rich', author: 'Iryna', at: Math.floor(Date.now() / 1000) - 400 * 86400,
      text: 'Astăzi m-am întors dintr-o excursie în care am petrecut timp în această casă magnifică situată pe un deal. Munții pitorești, pădurile de toamnă și aerul curat creează o atmosferă de liniște deplină. Mi-a plăcut în special șemineul: pe vreme rece nu numai că încălzește, dar creează și un confort incredibil. Fiecare colț al acestei case este pătruns de pace și armonie, iar aici m-am simțit ca acasă.',
    });
    expect(pickReview([thin, rich])?.id).toBe('rich');
  });

  it('steps away from a guest quoted recently', () => {
    const other = row({ id: 'other', author: 'Maria' });
    expect(pickReview([row({ id: 'ana' }), other], { recentAuthors: ['ana'] })?.id).toBe('other');
  });

  it('returns null rather than inventing one when the corpus is dry', () => {
    expect(pickReview([])).toBeNull();
  });
});
