import React from 'react';
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export default function TextEditor({ 
  selectedText, 
  onTextChange, 
  onDepthChange,
  onDelete,
  depth 
}) {
  if (!selectedText) return null;

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg">
		<h1>LOL!</h1>
      <Input
        value={selectedText.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Enter text..."
      />
      <div>
        <label className="text-sm">Depth</label>
        <Slider
          value={[depth]}
          onValueChange={([value]) => onDepthChange(value)}
          min={0}
          max={100}
          step={1}
        />
      </div>
      <Button variant="destructive" onClick={onDelete}>Delete</Button>
    </div>
  );
} 