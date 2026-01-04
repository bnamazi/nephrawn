'use client';

import { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';

interface NoteFormProps {
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function NoteForm({ onSubmit, onCancel, isLoading }: NoteFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onSubmit(content.trim());
    setContent('');
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit}>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Add Note</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder="Enter your note..."
          disabled={isLoading}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isLoading || !content.trim()}
            isLoading={isLoading}
          >
            Save Note
          </Button>
        </div>
      </form>
    </Card>
  );
}
