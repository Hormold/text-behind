import React from 'react';
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Add font constants
const FONTS = {
  FORUM: "'Forum', serif",
  INSTRUMENT: "'Instrument Serif', serif",
  OPEN_SANS: "'Open Sans', sans-serif",
  LATO: "'Lato', sans-serif",
  MONTSERRAT: "'Montserrat', serif",
  ROBOTO_CONDENSED: "'Roboto Condensed', sans-serif",
  OSWALD: "'Oswald', sans-serif",
  POPPINS: "'Poppins', sans-serif",
  RALEWAY: "'Raleway', sans-serif",
  SLABO: "'Slabo 27px', serif"
};

const TextEditor = ({
  textLayers,
  selectedText,
  setSelectedText,
  setTextLayers,
  handleAddText,
  mask,
  loadedFonts,
  handleFontChange
}) => (
  <div className="w-80 flex flex-col gap-4">
    <div className="flex justify-between items-center">
      <h3 className="font-medium text-lg">Text Layers</h3>
      <Button
        onClick={handleAddText}
        variant="outline"
        size="sm"
        disabled={!mask}>
        <Plus className="w-4 h-4 mr-2" /> Add Text
      </Button>
    </div>

    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
      {textLayers.map(layer => (
        <div
          key={layer.id}
          className={cn(
            "p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors",
            selectedText?.id === layer.id ? "border-primary bg-accent" : "border-muted"
          )}
          onClick={() => setSelectedText(layer)}
        >
          <p className="truncate font-medium" style={{ fontFamily: layer.fontFamily }}>
            {layer.text}
          </p>
        </div>
      ))}
    </div>

    {selectedText && (
      <div className="flex flex-col gap-4 p-4 border rounded-lg">
        <h4 className="font-medium">Edit Text</h4>
        <Input
          value={selectedText.text}
          onChange={(e) => {
            const newText = e.target.value;
            setTextLayers(layers =>
              layers.map(l => l.id === selectedText.id ? { ...l, text: newText } : l)
            );
            setSelectedText(prev => ({ ...prev, text: newText }));
          }}
          placeholder="Enter text..."
          style={{ fontFamily: selectedText.fontFamily }}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Font Size</label>
          <div className="flex gap-2 items-center">
            <Slider
              value={[selectedText.fontSize]}
              onValueChange={([value]) => {
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, fontSize: value } : l)
                );
                setSelectedText(prev => ({ ...prev, fontSize: value }));
              }}
              min={12}
              max={72}
              step={1}
              className="flex-1"
            />
            <span className="text-sm w-8">{selectedText.fontSize.toFixed(0)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Stroke Width</label>
          <div className="flex gap-2 items-center">
            <Slider
              value={[selectedText.strokeWidth]}
              onValueChange={([value]) => {
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, strokeWidth: value } : l)
                );
                setSelectedText(prev => ({ ...prev, strokeWidth: value }));
              }}
              min={0}
              max={10}
              step={0.5}
              className="flex-1"
            />
            <span className="text-sm w-8">{selectedText.strokeWidth}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Opacity</label>
          <div className="flex gap-2 items-center">
            <Slider
              value={[selectedText.opacity]}
              onValueChange={([value]) => {
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, opacity: value } : l)
                );
                setSelectedText(prev => ({ ...prev, opacity: value }));
              }}
              min={0}
              max={1}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm w-8">{selectedText.opacity.toFixed(1)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Shadow Blur</label>
          <div className="flex gap-2 items-center">
            <Slider
              value={[selectedText.shadowBlur]}
              onValueChange={([value]) => {
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, shadowBlur: value } : l)
                );
                setSelectedText(prev => ({ ...prev, shadowBlur: value }));
              }}
              min={0}
              max={10}
              step={0.5}
              className="flex-1"
            />
            <span className="text-sm w-8">{selectedText.shadowBlur}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Letter Spacing</label>
          <div className="flex gap-2 items-center">
            <Slider
              value={[selectedText.letterSpacing]}
              onValueChange={([value]) => {
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, letterSpacing: value } : l)
                );
                setSelectedText(prev => ({ ...prev, letterSpacing: value }));
              }}
              min={-5}
              max={20}
              step={0.5}
              className="flex-1"
            />
            <span className="text-sm w-8">{selectedText.letterSpacing}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Line Height</label>
          <div className="flex gap-2 items-center">
            <Slider
              value={[selectedText.lineHeight]}
              onValueChange={([value]) => {
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, lineHeight: value } : l)
                );
                setSelectedText(prev => ({ ...prev, lineHeight: value }));
              }}
              min={0.8}
              max={2}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm w-8">{selectedText.lineHeight.toFixed(1)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Text Color</label>
            <Input
              type="color"
              value={selectedText.fillColor}
              onChange={(e) => {
                const newColor = e.target.value;
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, fillColor: newColor } : l)
                );
                setSelectedText(prev => ({ ...prev, fillColor: newColor }));
              }}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Stroke Color</label>
            <Input
              type="color"
              value={selectedText.strokeColor}
              onChange={(e) => {
                const newColor = e.target.value;
                setTextLayers(layers =>
                  layers.map(l => l.id === selectedText.id ? { ...l, strokeColor: newColor } : l)
                );
                setSelectedText(prev => ({ ...prev, strokeColor: newColor }));
              }}
              className="h-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Font Family</label>
          <select
            value={selectedText.fontFamily}
            onChange={(e) => handleFontChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(FONTS).map(([key, value]) => (
              <option key={key} value={value} style={{ fontFamily: value }}>
                {key.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            setTextLayers(layers => layers.filter(l => l.id !== selectedText.id));
            setSelectedText(null);
          }}
        >
          Delete
        </Button>
      </div>
    )}
  </div>
);

export default TextEditor; 