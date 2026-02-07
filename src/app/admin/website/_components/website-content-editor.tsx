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
      // Reload from server would be ideal, but for now just clear dirty
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
    <div className="flex gap-6 min-h-[600px]">
      {/* Left sidebar - Page list */}
      <div className="w-[250px] shrink-0 space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground px-3 pb-2">Pages</h3>
        {Object.keys(pages).map((pageKey) => {
          const isVisible = visiblePages.includes(pageKey);
          const isActive = activePage === pageKey;
          return (
            <div
              key={pageKey}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <button
                className="flex-1 text-left"
                onClick={() => setActivePage(pageKey)}
              >
                {getPageTitle(pageKey)}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVisibilityToggle(pageKey);
                }}
                className={`p-1 rounded-sm transition-colors ${
                  isActive
                    ? 'hover:bg-primary-foreground/20'
                    : 'hover:bg-muted-foreground/20'
                }`}
                title={isVisible ? 'Hide page' : 'Show page'}
              >
                {isVisible ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 opacity-50" />
                )}
              </button>
            </div>
          );
        })}

        {/* Preview button */}
        <div className="pt-4 px-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const pagePath = activePage === 'homepage' ? '' : `/${activePage}`;
              window.open(`/properties/${propertySlug}${pagePath}`, '_blank');
            }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-2" />
            Preview Page
          </Button>
        </div>
      </div>

      {/* Right area - Block editors */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{getPageTitle(activePage)}</h2>
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

        {currentPageBlocks.length > 0 ? (
          <Accordion type="multiple" className="space-y-2">
            {currentPageBlocks.map((block) => {
              const blockContent = (currentPageOverrides[block.id] || templateDefaults[block.id] || {}) as Record<string, unknown>;
              const isHidden = blockContent._hidden === true;

              return (
                <AccordionItem
                  key={block.id}
                  value={block.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span>{getBlockLabel(block)}</span>
                      <Badge variant={isHidden ? 'secondary' : 'outline'} className="text-xs">
                        {isHidden ? 'Hidden' : 'Visible'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
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
    </div>
  );
}
