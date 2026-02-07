'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MultilingualInput } from './multilingual-input';
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

  const [menuItems, setMenuItems] = useState<MenuItemData[]>(
    (initialOverrides.menuItems as MenuItemData[]) || []
  );

  const footer = (initialOverrides.footer || {}) as Record<string, unknown>;
  const [quickLinks, setQuickLinks] = useState<MenuItemData[]>(
    (footer.quickLinks as MenuItemData[]) || []
  );
  const [socialLinks, setSocialLinks] = useState<SocialLinkData[]>(
    (footer.socialLinks as SocialLinkData[]) || []
  );

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
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Menu Items */}
      <Card>
        <CardHeader>
          <CardTitle>Header Menu Items</CardTitle>
          <CardDescription>Links shown in the website header navigation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {menuItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="flex-1 space-y-3">
                <MultilingualInput
                  label="Label"
                  value={item.label}
                  onChange={(v) => {
                    const updated = [...menuItems];
                    updated[i] = { ...updated[i], label: v };
                    setMenuItems(updated);
                  }}
                />
                <div className="space-y-1.5">
                  <Label className="text-sm">URL</Label>
                  <Input
                    value={item.url}
                    onChange={(e) => {
                      const updated = [...menuItems];
                      updated[i] = { ...updated[i], url: e.target.value };
                      setMenuItems(updated);
                    }}
                    placeholder="/booking or https://..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.isButton || false}
                    onCheckedChange={(checked) => {
                      const updated = [...menuItems];
                      updated[i] = { ...updated[i], isButton: checked };
                      setMenuItems(updated);
                    }}
                  />
                  <Label className="text-sm">Show as button</Label>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuItems(menuItems.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMenuItems([...menuItems, { label: { en: '' }, url: '' }])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Menu Item
          </Button>
        </CardContent>
      </Card>

      {/* Footer Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Quick Links</CardTitle>
          <CardDescription>Links shown in the website footer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quickLinks.map((link, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="flex-1 space-y-3">
                <MultilingualInput
                  label="Label"
                  value={link.label}
                  onChange={(v) => {
                    const updated = [...quickLinks];
                    updated[i] = { ...updated[i], label: v };
                    setQuickLinks(updated);
                  }}
                />
                <div className="space-y-1.5">
                  <Label className="text-sm">URL</Label>
                  <Input
                    value={link.url}
                    onChange={(e) => {
                      const updated = [...quickLinks];
                      updated[i] = { ...updated[i], url: e.target.value };
                      setQuickLinks(updated);
                    }}
                    placeholder="/details or https://..."
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuickLinks(quickLinks.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickLinks([...quickLinks, { label: { en: '' }, url: '' }])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Quick Link
          </Button>
        </CardContent>
      </Card>

      {/* Footer Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Social Links</CardTitle>
          <CardDescription>Social media links shown in the website footer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-3">
              <Select
                value={link.platform}
                onValueChange={(v) => {
                  const updated = [...socialLinks];
                  updated[i] = { ...updated[i], platform: v };
                  setSocialLinks(updated);
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
                  setSocialLinks(updated);
                }}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSocialLinks(socialLinks.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSocialLinks([...socialLinks, { platform: 'facebook', url: '' }])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Social Link
          </Button>
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

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Navigation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
