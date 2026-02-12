'use client';

import { useState, useCallback } from 'react';
import { Save, RotateCcw, ExternalLink, Loader2, Eye, EyeOff, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { savePageContent, updateVisiblePages, initializePageFromTemplate } from '../actions';
import { BlockEditor } from './block-editor';

// Human-readable page names
const PAGE_LABELS: Record<string, string> = {
  homepage: 'Homepage',
  details: 'Details',
  location: 'Location',
  gallery: 'Gallery',
  booking: 'Booking',
};

// Human-readable block type labels
const BLOCK_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero Banner',
  experience: 'Experience Highlights',
  host: 'Host Introduction',
  features: 'Features',
  location: 'Location Highlights',
  testimonials: 'Testimonials',
  gallery: 'Gallery Preview',
  cta: 'Call to Action',
  pageHeader: 'Page Header',
  amenitiesList: 'Amenities',
  roomsList: 'Rooms',
  specificationsList: 'Specifications',
  pricingTable: 'Pricing Table',
  fullMap: 'Map',
  attractionsList: 'Nearby Attractions',
  transportOptions: 'Transport Options',
  distancesList: 'Distances',
  galleryGrid: 'Gallery Grid',
  photoCategories: 'Photo Categories',
  fullBookingForm: 'Booking Form',
  policiesList: 'Policies',
  text: 'Text Block',
  faq: 'FAQ',
};

interface WebsiteContentEditorProps {
  propertyId: string;
  property: Record<string, unknown>;
  template: Record<string, unknown>;
  initialOverrides: Record<string, unknown>;
}

export function WebsiteContentEditor({
  propertyId,
  property,
  template,
  initialOverrides,
}: WebsiteContentEditorProps) {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, unknown>>(initialOverrides);
  const [activePage, setActivePage] = useState('homepage');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const pages = (template.pages || {}) as Record<string, { path: string; title: string | Record<string, string>; blocks: Array<{ id: string; type: string }> }>;
  const templateDefaults = (template.defaults || {}) as Record<string, unknown>;
  const visiblePages = (overrides.visiblePages || Object.keys(pages)) as string[];
  const propertySlug = property.slug as string;
  const propertyImages = (property.images || []) as Array<{ url: string; alt?: string; thumbnailUrl?: string }>;

  const currentPageBlocks = pages[activePage]?.blocks || [];
  const currentPageOverrides = (overrides[activePage] || {}) as Record<string, unknown>;

  const handleBlockChange = useCallback((blockId: string, content: unknown) => {
    setOverrides((prev) => ({
      ...prev,
      [activePage]: {
        ...(prev[activePage] as Record<string, unknown> || {}),
        [blockId]: content,
      },
    }));
    setIsDirty(true);
  }, [activePage]);

  const handleVisibilityToggle = useCallback(async (pageName: string) => {
    const currentVisible = (overrides.visiblePages || Object.keys(pages)) as string[];
    const newVisible = currentVisible.includes(pageName)
      ? currentVisible.filter((p) => p !== pageName)
      : [...currentVisible, pageName];

    setOverrides((prev) => ({ ...prev, visiblePages: newVisible }));
    const result = await updateVisiblePages(propertyId, newVisible);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  }, [overrides.visiblePages, pages, propertyId, toast]);

  const handleBlockVisibilityToggle = useCallback((blockId: string) => {
    const pageOverrides = (overrides[activePage] as Record<string, unknown>) || {};
    const blockContent = (pageOverrides[blockId] || {}) as Record<string, unknown>;
    const currentlyHidden = blockContent._hidden === true;

    handleBlockChange(blockId, { ...blockContent, _hidden: !currentlyHidden });
  }, [activePage, overrides, handleBlockChange]);

  const handleSave = async () => {
    setIsSaving(true);
    const pageData = (overrides[activePage] || {}) as Record<string, unknown>;
    const result = await savePageContent(propertyId, activePage, pageData);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: `${PAGE_LABELS[activePage] || activePage} content saved.` });
      setIsDirty(false);
    }
    setIsSaving(false);
  };

  const handleDiscard = () => {
    setOverrides(initialOverrides);
    setIsDirty(false);
  };

  const handleInitializeFromTemplate = async () => {
    setIsInitializing(true);
    const templateId = (property.templateId as string) || 'holiday-house';
    const result = await initializePageFromTemplate(propertyId, activePage, templateId);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Initialized', description: `${PAGE_LABELS[activePage] || activePage} initialized from template defaults.` });
      window.location.reload();
    }
    setIsInitializing(false);
  };

  const getPageTitle = (key: string) => {
    return PAGE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const getBlockLabel = (block: { id: string; type: string }) => {
    return BLOCK_TYPE_LABELS[block.type] || block.id;
  };

  const hasPageContent = Object.keys(currentPageOverrides).length > 0;

  return (
    <div className="space-y-4">
      {/* Page tabs */}
      <div className="flex items-center gap-1 border-b">
        {Object.keys(pages).map((pageKey) => {
          const isVisible = visiblePages.includes(pageKey);
          const isActive = activePage === pageKey;
          return (
            <div
              key={pageKey}
              role="tab"
              tabIndex={0}
              onClick={() => setActivePage(pageKey)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePage(pageKey); }}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-md cursor-pointer select-none ${
                isActive
                  ? 'text-foreground bg-background border border-b-0 border-border -mb-px'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <span>{getPageTitle(pageKey)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVisibilityToggle(pageKey);
                }}
                className={`p-0.5 rounded transition-colors ${
                  isActive
                    ? 'hover:bg-muted'
                    : 'hover:bg-muted-foreground/20'
                }`}
                title={isVisible ? 'Page visible — click to hide' : 'Page hidden — click to show'}
              >
                {isVisible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3 opacity-40" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!hasPageContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInitializeFromTemplate}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5 mr-2" />
              )}
              Initialize from Template
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const pagePath = activePage === 'homepage' ? '' : `/${activePage}`;
            window.open(`/properties/${propertySlug}${pagePath}`, '_blank');
          }}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Preview
        </Button>
      </div>

      {/* Block editors */}
      {currentPageBlocks.length > 0 ? (
        <Accordion type="multiple" className="space-y-2">
          {currentPageBlocks.map((block) => {
            const blockContent = (currentPageOverrides[block.id] || templateDefaults[block.id] || templateDefaults[block.type] || {}) as Record<string, unknown>;
            const isHidden = blockContent._hidden === true;

            return (
              <AccordionItem
                key={block.id}
                value={block.id}
                className="border rounded-lg overflow-hidden data-[state=open]:border-primary/30 data-[state=open]:shadow-sm transition-all"
              >
                <AccordionTrigger className="px-4 hover:no-underline data-[state=open]:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getBlockLabel(block)}</span>
                    {isHidden ? (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <EyeOff className="h-3 w-3" /> Hidden
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Visible
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t bg-muted/10">
                  <div className="px-4 pt-4 pb-4">
                    <div className="flex justify-end mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBlockVisibilityToggle(block.id)}
                      >
                        {isHidden ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Show Block
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide Block
                          </>
                        )}
                      </Button>
                    </div>
                    <BlockEditor
                      blockId={block.id}
                      blockType={block.type}
                      content={blockContent}
                      onChange={(content) => handleBlockChange(block.id, content)}
                      propertySlug={propertySlug}
                      propertyImages={propertyImages}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              No blocks defined for this page in the template.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky bottom-4 z-40">
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4 shadow-lg">
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
