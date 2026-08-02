/** @jest-environment node */

import { buildGenerationPrompt } from '../generationPrompt';

describe('buildGenerationPrompt', () => {
  it('splices the need into a fixed skeleton and always includes the never-invent guardrail', () => {
    const p = buildGenerationPrompt('seasonal', 'winter snow on the ground and trees', 'A wood chalet among green trees');
    expect(p).toContain('winter snow on the ground and trees');
    expect(p).toContain('A wood chalet among green trees'); // the base summary
    expect(p).toMatch(/do not add, remove, or alter/i); // the guardrail
    expect(p).toMatch(/season\/weather/i); // the seasonal skeleton
  });

  it('uses a distinct skeleton per transform', () => {
    expect(buildGenerationPrompt('relight', 'golden-hour light', 's')).toMatch(/lighting\/time-of-day/i);
    expect(buildGenerationPrompt('populate_people', 'a family cooking', 's')).toMatch(/add people/i);
  });

  it('degrades gracefully with no base summary', () => {
    const p = buildGenerationPrompt('relight', 'sunset', '');
    expect(p).toContain('Edit the attached base photo');
    expect(p).toMatch(/do not add, remove, or alter/i);
  });
});
