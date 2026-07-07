/** @jest-environment node */

/**
 * Language-aware template resolution (#2). The marketing registry reads env at
 * module load, so each case sets env then re-requires the module.
 */
describe('resolveWhatsAppTemplateSid — language selection', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
    jest.resetModules();
  });

  it('selects the requested language variant', () => {
    process.env.WHATSAPP_TPL_WINTER_INVITE_EN = 'HX-en';
    process.env.WHATSAPP_TPL_WINTER_INVITE_RO = 'HX-ro';
    jest.resetModules();
    const { resolveWhatsAppTemplateSid } = require('../whatsappService');
    expect(resolveWhatsAppTemplateSid('winter_invite', 'ro')).toBe('HX-ro');
    expect(resolveWhatsAppTemplateSid('winter_invite', 'en')).toBe('HX-en');
  });

  it('falls back to EN when the language variant is unset', () => {
    process.env.WHATSAPP_TPL_WINTER_INVITE_EN = 'HX-en';
    delete process.env.WHATSAPP_TPL_WINTER_INVITE_RO;
    jest.resetModules();
    const { resolveWhatsAppTemplateSid } = require('../whatsappService');
    expect(resolveWhatsAppTemplateSid('winter_invite', 'ro')).toBe('HX-en');
  });

  it('returns undefined for an unapproved template (no env set = inert)', () => {
    delete process.env.WHATSAPP_TPL_WINTER_INVITE_EN;
    delete process.env.WHATSAPP_TPL_WINTER_INVITE_RO;
    jest.resetModules();
    const { resolveWhatsAppTemplateSid } = require('../whatsappService');
    expect(resolveWhatsAppTemplateSid('winter_invite', 'en')).toBeUndefined();
    expect(resolveWhatsAppTemplateSid('unknown_template', 'en')).toBeUndefined();
  });

  it('resolves ops templates regardless of language (single SID)', () => {
    jest.resetModules();
    const { resolveWhatsAppTemplateSid } = require('../whatsappService');
    // curatenie_test is a real ops template SID in the registry
    expect(resolveWhatsAppTemplateSid('curatenie_test', 'ro')).toBeDefined();
  });
});
