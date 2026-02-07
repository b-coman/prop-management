'use server';

import { revalidatePath } from 'next/cache';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';

const logger = loggers.admin;

// ============================================================================
// Website Settings
// ============================================================================

export interface WebsiteSettings {
  themeId?: string;
  templateId?: string;
  customDomain?: string | null;
  useCustomDomain?: boolean;
  analytics?: {
    enabled: boolean;
    googleAnalyticsId?: string;
  };
  googlePlaceId?: string;
}

export async function fetchPropertyWebsiteSettings(
  propertyId: string
): Promise<WebsiteSettings | null> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();
    const doc = await db.collection('properties').doc(propertyId).get();
    if (!doc.exists) return null;

    const data = convertTimestampsToISOStrings(doc.data()!);
    return {
      themeId: data.themeId,
      templateId: data.templateId,
      customDomain: data.customDomain,
      useCustomDomain: data.useCustomDomain,
      analytics: data.analytics,
      googlePlaceId: data.googlePlaceId,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchPropertyWebsiteSettings', { propertyId });
      return null;
    }
    logger.error('Error fetching website settings', error as Error, { propertyId });
    return null;
  }
}

export async function updateWebsiteSettings(
  propertyId: string,
  data: WebsiteSettings
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  try {
    const db = await getAdminDb();
    await db.collection('properties').doc(propertyId).update({
      themeId: data.themeId,
      customDomain: data.customDomain || null,
      useCustomDomain: data.useCustomDomain || false,
      analytics: data.analytics || { enabled: false },
      googlePlaceId: data.googlePlaceId || '',
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Website settings updated', { propertyId });
    revalidatePath(`/admin/website/settings`);
    revalidatePath(`/admin/properties/${propertyId}`);
    revalidatePath(`/properties/${propertyId}`);
    return {};
  } catch (error) {
    logger.error('Error updating website settings', error as Error, { propertyId });
    return { error: 'Failed to update website settings' };
  }
}

// ============================================================================
// Property Overrides CRUD
// ============================================================================

export async function fetchPropertyOverrides(propertyId: string): Promise<Record<string, unknown> | null> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();
    const doc = await db.collection('propertyOverrides').doc(propertyId).get();
    if (!doc.exists) return null;
    return convertTimestampsToISOStrings(doc.data()!) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchPropertyOverrides', { propertyId });
      return null;
    }
    logger.error('Error fetching property overrides', error as Error, { propertyId });
    return null;
  }
}

export async function fetchWebsiteTemplate(templateId: string): Promise<Record<string, unknown> | null> {
  try {
    const db = await getAdminDb();
    const doc = await db.collection('websiteTemplates').doc(templateId).get();
    if (!doc.exists) return null;
    return convertTimestampsToISOStrings(doc.data()!) as Record<string, unknown>;
  } catch (error) {
    logger.error('Error fetching website template', error as Error, { templateId });
    return null;
  }
}

export async function fetchPropertyForEditor(propertyId: string): Promise<Record<string, unknown> | null> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();
    const doc = await db.collection('properties').doc(propertyId).get();
    if (!doc.exists) return null;

    const data = convertTimestampsToISOStrings(doc.data()!);
    return {
      slug: propertyId,
      templateId: data.templateId || 'holiday-house',
      images: data.images || [],
      location: data.location || {},
      name: data.name,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      bedrooms: data.bedrooms,
      beds: data.beds,
      bathrooms: data.bathrooms,
      squareFeet: data.squareFeet,
      maxGuests: data.maxGuests,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      cancellationPolicy: data.cancellationPolicy,
      houseRules: data.houseRules,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchPropertyForEditor', { propertyId });
      return null;
    }
    logger.error('Error fetching property for editor', error as Error, { propertyId });
    return null;
  }
}

export async function savePageContent(
  propertyId: string,
  pageName: string,
  pageData: Record<string, unknown>
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  try {
    const db = await getAdminDb();
    await db.collection('propertyOverrides').doc(propertyId).set(
      {
        [pageName]: pageData,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info('Page content saved', { propertyId, pageName });
    revalidatePath(`/admin/website`);
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath(`/properties/${propertyId}/${pageName}`);
    return {};
  } catch (error) {
    logger.error('Error saving page content', error as Error, { propertyId, pageName });
    return { error: 'Failed to save page content' };
  }
}

export async function updateVisiblePages(
  propertyId: string,
  visiblePages: string[]
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  try {
    const db = await getAdminDb();
    await db.collection('propertyOverrides').doc(propertyId).set(
      {
        visiblePages,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info('Visible pages updated', { propertyId, visiblePages });
    revalidatePath(`/admin/website`);
    revalidatePath(`/properties/${propertyId}`);
    return {};
  } catch (error) {
    logger.error('Error updating visible pages', error as Error, { propertyId });
    return { error: 'Failed to update visible pages' };
  }
}

export async function initializePageFromTemplate(
  propertyId: string,
  pageName: string,
  templateId: string
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const templateDoc = await db.collection('websiteTemplates').doc(templateId).get();
    if (!templateDoc.exists) {
      return { error: 'Template not found' };
    }

    const template = templateDoc.data()!;
    const defaults = template.defaults || {};
    const pageBlocks = template.pages?.[pageName]?.blocks || [];

    // Build default content for this page from template defaults
    const pageDefaults: Record<string, unknown> = {};
    for (const block of pageBlocks) {
      if (defaults[block.id]) {
        pageDefaults[block.id] = defaults[block.id];
      }
    }

    await db.collection('propertyOverrides').doc(propertyId).set(
      {
        [pageName]: pageDefaults,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info('Page initialized from template', { propertyId, pageName, templateId });
    revalidatePath(`/admin/website`);
    revalidatePath(`/properties/${propertyId}`);
    return {};
  } catch (error) {
    logger.error('Error initializing page from template', error as Error, { propertyId, pageName });
    return { error: 'Failed to initialize page from template' };
  }
}

export async function saveNavigationData(
  propertyId: string,
  data: {
    menuItems?: Array<{ label: string | Record<string, string>; url: string; isButton?: boolean }>;
    footer?: {
      quickLinks?: Array<{ label: string | Record<string, string>; url: string }>;
      socialLinks?: Array<{ platform: string; url: string }>;
    };
  }
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  try {
    const db = await getAdminDb();
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (data.menuItems !== undefined) {
      updateData.menuItems = data.menuItems;
    }
    if (data.footer !== undefined) {
      updateData.footer = data.footer;
    }

    await db.collection('propertyOverrides').doc(propertyId).set(updateData, { merge: true });

    logger.info('Navigation data saved', { propertyId });
    revalidatePath(`/admin/website/navigation`);
    revalidatePath(`/properties/${propertyId}`);
    return {};
  } catch (error) {
    logger.error('Error saving navigation data', error as Error, { propertyId });
    return { error: 'Failed to save navigation data' };
  }
}
