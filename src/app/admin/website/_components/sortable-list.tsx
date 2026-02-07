'use client';

import { useRef, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SortableItemProps {
  id: string;
  children: ReactNode;
  onRemove: () => void;
}

function SortableItem({ id, children, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 items-start border rounded-lg p-4 bg-background ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

interface SortableListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  renderItem: (item: T, index: number) => ReactNode;
  addLabel?: string;
}

export function SortableList<T>({
  items,
  onReorder,
  onRemove,
  onAdd,
  renderItem,
  addLabel = 'Add Item',
}: SortableListProps<T>) {
  const nextId = useRef(0);
  const idsRef = useRef<string[]>(items.map(() => `s-${nextId.current++}`));

  // Sync IDs when items are added (always at end)
  while (idsRef.current.length < items.length) {
    idsRef.current.push(`s-${nextId.current++}`);
  }
  // Trim when items are removed
  if (idsRef.current.length > items.length) {
    idsRef.current = idsRef.current.slice(0, items.length);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = idsRef.current.indexOf(String(active.id));
    const newIndex = idsRef.current.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    idsRef.current = arrayMove(idsRef.current, oldIndex, newIndex);
    onReorder(arrayMove([...items], oldIndex, newIndex));
  };

  const handleRemove = (index: number) => {
    idsRef.current.splice(index, 1);
    onRemove(index);
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={idsRef.current} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableItem
              key={idsRef.current[index]}
              id={idsRef.current[index]}
              onRemove={() => handleRemove(index)}
            >
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {addLabel}
      </Button>
    </div>
  );
}
