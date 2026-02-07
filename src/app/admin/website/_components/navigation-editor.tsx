'use client';

import { useState, useCallback, useMemo } from 'react';
import { Save, Loader2, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MultilingualInput } from './multilingual-input';
import { SortableList } from './sortable-list';
import { saveNavigationData } from '../actions';

type MenuItemData = {
  label: string | Record<string, string>;
  url: string;
  isButton?: boolean;
};

type SocialLinkData = {
  platform: string;
  url: string;
};

interface NavigationEditorProps {
  propertyId: string;
  initialOverrides: Record<string, unknown>;
}

export function NavigationEditor({ propertyId, initialOverrides }: NavigationEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const initialMenuItems = useMemo(
    () => (initialOverrides.menuItems as MenuItemData[]) || [],
    [initialOverrides.menuItems]
  );
  const initialFooter = useMemo(
    () => (initialOverrides.footer || {}) as Record<string, unknown>,
    [initialOverrides.footer]
  );
  const initialQuickLinks = useMemo(
    () => (initialFooter.quickLinks as MenuItemData[]) || [],
    [initialFooter.quickLinks]
  );
  const initialSocialLinks = useMemo(
    () => (initialFooter.socialLinks as SocialLinkData[]) || [],
    [initialFooter.socialLinks]
  );

  const [menuItems, setMenuItems] = useState<MenuItemData[]>(initialMenuItems);
  const [quickLinks, setQuickLinks] = useState<MenuItemData[]>(initialQuickLinks);
  const [socialLinks, setSocialLinks] = useState<SocialLinkData[]>(initialSocialLinks);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const updateMenuItems = useCallback((items: MenuItemData[]) => {
    setMenuItems(items);
    markDirty();
  }, [markDirty]);

  const updateQuickLinks = useCallback((items: MenuItemData[]) => {
    setQuickLinks(items);
    markDirty();
  }, [markDirty]);

  const updateSocialLinks = useCallback((items: SocialLinkData[]) => {
    setSocialLinks(items);
    markDirty();
  }, [markDirty]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveNavigationData(propertyId, {
      menuItems,
      footer: {
        quickLinks,
        socialLinks,
      },
    });
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Navigation settings saved.' });
      setIsDirty(false);
    }
    setIsSaving(false);
  };

  const handleDiscard = () => {
    setMenuItems(initialMenuItems);
    setQuickLinks(initialQuickLinks);
    setSocialLinks(initialSocialLinks);
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Menu Items */}
      <Card>
        <CardHeader>
          <CardTitle>Header Menu Items</CardTitle>
          <CardDescription>Links shown in the website header navigation. Drag to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <SortableList
            items={menuItems}
            onReorder={updateMenuItems}
            onRemove={(i) => updateMenuItems(menuItems.filter((_, idx) => idx !== i))}
            onAdd={() => updateMenuItems([...menuItems, { label: { en: '' }, url: '' }])}
            addLabel="Add Menu Item"
            compact
            renderItem={(item, i) => (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <MultilingualInput
                    label="Label"
                    value={item.label}
                    onChange={(v) => {
                      const updated = [...menuItems];
                      updated[i] = { ...updated[i], label: v };
                      updateMenuItems(updated);
                    }}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-sm">URL</Label>
                    <Input
                      value={item.url}
                      onChange={(e) => {
                        const updated = [...menuItems];
                        updated[i] = { ...updated[i], url: e.target.value };
                        updateMenuItems(updated);
                      }}
                      placeholder="/booking or https://..."
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.isButton || false}
                    onCheckedChange={(checked) => {
                      const updated = [...menuItems];
                      updated[i] = { ...updated[i], isButton: checked };
                      updateMenuItems(updated);
                    }}
                  />
                  <Label className="text-sm text-muted-foreground">Show as button</Label>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Footer Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Quick Links</CardTitle>
          <CardDescription>Links shown in the website footer. Drag to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <SortableList
            items={quickLinks}
            onReorder={updateQuickLinks}
            onRemove={(i) => updateQuickLinks(quickLinks.filter((_, idx) => idx !== i))}
            onAdd={() => updateQuickLinks([...quickLinks, { label: { en: '' }, url: '' }])}
            addLabel="Add Quick Link"
            compact
            renderItem={(link, i) => (
              <div className="grid grid-cols-2 gap-3">
                <MultilingualInput
                  label="Label"
                  value={link.label}
                  onChange={(v) => {
                    const updated = [...quickLinks];
                    updated[i] = { ...updated[i], label: v };
                    updateQuickLinks(updated);
                  }}
                />
                <div className="space-y-1.5">
                  <Label className="text-sm">URL</Label>
                  <Input
                    value={link.url}
                    onChange={(e) => {
                      const updated = [...quickLinks];
                      updated[i] = { ...updated[i], url: e.target.value };
                      updateQuickLinks(updated);
                    }}
                    placeholder="/details or https://..."
                  />
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Footer Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Social Links</CardTitle>
          <CardDescription>Social media links shown in the website footer. Drag to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <SortableList
            items={socialLinks}
            onReorder={updateSocialLinks}
            onRemove={(i) => updateSocialLinks(socialLinks.filter((_, idx) => idx !== i))}
            onAdd={() => updateSocialLinks([...socialLinks, { platform: 'facebook', url: '' }])}
            addLabel="Add Social Link"
            compact
            renderItem={(link, i) => (
              <div className="flex items-center gap-3">
                <Select
                  value={link.platform}
                  onValueChange={(v) => {
                    const updated = [...socialLinks];
                    updated[i] = { ...updated[i], platform: v };
                    updateSocialLinks(updated);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={link.url}
                  onChange={(e) => {
                    const updated = [...socialLinks];
                    updated[i] = { ...updated[i], url: e.target.value };
                    updateSocialLinks(updated);
                  }}
                  placeholder="https://..."
                  className="flex-1"
                />
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Contact info note */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Contact information (phone and email) shown in the footer is pulled from your Property Settings.
              Edit it in{' '}
              <a href="/admin/properties" className="text-primary underline underline-offset-4">
                Properties
              </a>.
            </p>
          </div>
        </CardContent>
      </Card>

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
                {isSaving ? 'Saving...' : 'Save Navigation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
