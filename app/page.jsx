"use client";

import React, {
  useState,
  useEffect,
  useRef,
} from "react";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";
import TextEditor from '@/components/TextEditor';
// UI
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import InputDialog from "@/components/ui/inputdialog";
import { Button } from "@/components/ui/button";
import {
  Github,
  Fan,
} from "lucide-react";
import { QuickGuide } from '@/components/QuickGuide';
import { Toolbar } from '@/components/Toolbar';

// Image manipulations
import {
  resizeCanvas,
  maskImageCanvas,
  resizeAndPadBox,
  canvasToFloat32Array,
  float32ArrayToCanvas,
  sliceTensor
} from "@/lib/imageutils";

// Add font constants at the top
const FONTS = {
  FORUM: "'Forum', serif",
  INSTRUMENT: "'Instrument Serif', serif",
  OPEN_SANS: "'Open Sans', sans-serif",
  LATO: "'Lato', sans-serif",
  MONTSERRAT: "'Montserrat', sans-serif",
  ROBOTO_CONDENSED: "'Roboto Condensed', sans-serif",
  OSWALD: "'Oswald', sans-serif",
  POPPINS: "'Poppins', sans-serif",
  RALEWAY: "'Raleway', sans-serif",
  SLABO: "'Slabo 27px', serif"
};

// Default font weights for each font
const FONT_WEIGHTS = {
  LIGHT: 300,
  REGULAR: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700
};

export default function Home() {
  // resize+pad all images to 1024x1024
  const imageSize = { w: 1024, h: 1024 };
  const maskSize = { w: 256, h: 256 };

  // state
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageEncoded, setImageEncoded] = useState(false);
  const [status, setStatus] = useState("");

  // web worker, image and mask
  const samWorker = useRef(null);
  const [image, setImage] = useState(null); // canvas
  const [mask, setMask] = useState(null); // canvas
  const [prevMaskArray, setPrevMaskArray] = useState(null); // Float32Array
  const [imageURL, setImageURL] = useState(
    "https://upload.wikimedia.org/wikipedia/commons/3/38/Flamingos_Laguna_Colorada.jpg"
  );
  const canvasEl = useRef(null);
  const fileInputEl = useRef(null);
  const pointsRef = useRef([]);

  const [stats, setStats] = useState(null);

  // input dialog for custom URLs
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const inputDialogDefaultURL = "https://upload.wikimedia.org/wikipedia/commons/9/96/Pro_Air_Martin_404_N255S.jpg"

  // Add after other state declarations
  const [showMask, setShowMask] = useState(false);
  const [textLayers, setTextLayers] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedText = useRef(null);
  const [blockMaskClick, setBlockMaskClick] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, fontSize: 0 });
  const resizingText = useRef(null);
  const [resizeHandle, setResizeHandle] = useState(null); // 'tl', 'tr', 'bl', 'br'
  const [showBorder, setShowBorder] = useState(true);

  // Add font loading check
  const [loadedFonts, setLoadedFonts] = useState(new Set());

  // Add font loading effect
  useEffect(() => {
    const loadFonts = async () => {
      for (const font of Object.values(FONTS)) {
        try {
          await document.fonts.load(`16px ${font}`);
          setLoadedFonts(prev => new Set([...prev, font]));
        } catch (e) {
          console.error(`Failed to load font: ${font}`, e);
        }
      }
    };
    loadFonts();
  }, []);

  // Add helper function for coordinate conversion
  const convertCoordinates = (clientX, clientY, canvas, targetSize) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: (x / canvas.width) * targetSize.w,
      y: (y / canvas.height) * targetSize.h
    };
  };

  // Start encoding image
  const encodeImageClick = async () => {
    samWorker.current.postMessage({
      type: "encodeImage",
      data: canvasToFloat32Array(resizeCanvas(image, imageSize)),
    });

    setLoading(true);
    setStatus("Encoding");
  };

  // Start decoding, prompt with mouse coords
  const imageClick = (event) => {
    if (!imageEncoded || isDragging || blockMaskClick) return;
    event.preventDefault();

    const canvas = canvasEl.current;
    const { x, y } = convertCoordinates(event.clientX, event.clientY, canvas, imageSize);

    const point = {
      x,
      y,
      label: 1, // Always positive selection
    };

    // If shift is held, add to points, otherwise reset
    if (event.shiftKey) {
      pointsRef.current = [...pointsRef.current, point];
    } else {
      pointsRef.current = [point];
    }

    if (prevMaskArray) {
      const maskShape = [1, 1, maskSize.w, maskSize.h]
      samWorker.current.postMessage({
        type: "decodeMask",
        data: {
          points: pointsRef.current,
          maskArray: prevMaskArray,
          maskShape: maskShape,
        }
      });
    } else {
      samWorker.current.postMessage({
        type: "decodeMask",
        data: {
          points: pointsRef.current,
          maskArray: null,
          maskShape: null,
        }
      });
    }

    setLoading(true);
    setStatus("Decoding");
    setSelectedObject(point);
  };

  // Decoding finished -> parse result and update mask
  const handleDecodingResults = (decodingResults) => {
    // SAM2 returns 3 mask along with scores -> select best one
    const maskTensors = decodingResults.masks;
    const [bs, noMasks, width, height] = maskTensors.dims;
    const maskScores = decodingResults.iou_predictions.cpuData;
    const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
    const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx)
    let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height)
    bestMaskCanvas = resizeCanvas(bestMaskCanvas, imageSize);

    setMask(bestMaskCanvas);
    setPrevMaskArray(bestMaskArray);
  };

  // Handle web worker messages
  const onWorkerMessage = (event) => {
    const { type, data } = event.data;

    if (type == "pong") {
      const { success, device } = data;

      if (success) {
        setLoading(false);
        setDevice(device);
        setStatus("Encode image");
      } else {
        setStatus("Error (check JS console)");
      }
    } else if (type == "downloadInProgress" || type == "loadingInProgress") {
      setLoading(true);
      setStatus("Loading model");
    } else if (type == "encodeImageDone") {
      // alert(data.durationMs)
      setImageEncoded(true);
      setLoading(false);
      setStatus("Ready. Click on image");
    } else if (type == "decodeMaskResult") {
      handleDecodingResults(data);
      setLoading(false);
      setStatus("Ready. Click on image");
    } else if (type == "stats") {
      setStats(data);
    }
  };

  // Crop image with mask
  const cropClick = (event) => {
    const link = document.createElement("a");
    link.href = maskImageCanvas(image, mask).toDataURL();
    link.download = "crop.png";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset all the image-based state: points, mask, offscreen canvases .. 
  const resetState = () => {
    pointsRef.current = [];
    setImage(null);
    setMask(null);
    setPrevMaskArray(null);
    setImageEncoded(false);
    setTextLayers([]); // Reset text when loading new image
  }

  // Reset only mask, preserve text
  const resetMask = () => {
    pointsRef.current = [];
    setMask(null);
    setPrevMaskArray(null);
  }

  // New image: From File
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    const dataURL = window.URL.createObjectURL(file)

    resetState()
    setStatus("Encode image")
    setImageURL(dataURL)
  }

  // New image: From URL 
  const handleUrl = (urlText) => {
    const tryLoadImage = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();

        // Добавим таймаут для быстрого фейла при CORS
        const timeoutId = setTimeout(() => {
          console.log('Image load timed out');
          img.src = ''; // прерываем загрузку
          reject(new Error('Image load timed out'));
        }, 3000);

        img.onload = () => {
          clearTimeout(timeoutId);
          console.log('Image loaded successfully');
          resolve(url);
        };

        img.onerror = (e) => {
          clearTimeout(timeoutId);
          console.error('Image load failed:', e);
          reject(new Error('Image load failed'));
        };

        img.crossOrigin = "anonymous";
        img.src = url;
      });
    };

    const loadWithProxy = (originalUrl) => {
      console.log('Using proxy for:', originalUrl);
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}`;
      resetState();
      setStatus("Encode image (via proxy)");
      setImageURL(proxyUrl);
    };

    tryLoadImage(urlText)
      .then(() => {
        console.log('Direct load successful');
        resetState();
        setStatus("Encode image");
        setImageURL(urlText);
      })
      .catch((error) => {
        console.log('Falling back to proxy due to:', error);
        loadWithProxy(urlText);
      });
  };

  function handleRequestStats() {
    samWorker.current.postMessage({ type: "stats" });
  }

  // Load web worker
  useEffect(() => {
    if (!samWorker.current) {
      samWorker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
      samWorker.current.addEventListener("message", onWorkerMessage);
      samWorker.current.postMessage({ type: "ping" });

      setLoading(true);
    }
  }, [onWorkerMessage, handleDecodingResults]);

  // Load image, pad to square and store in offscreen canvas
  useEffect(() => {
    if (imageURL) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageURL;
      img.onload = function () {
        const largestDim =
          img.naturalWidth > img.naturalHeight
            ? img.naturalWidth
            : img.naturalHeight;
        const box = resizeAndPadBox(
          { h: img.naturalHeight, w: img.naturalWidth },
          { h: largestDim, w: largestDim }
        );

        const canvas = document.createElement("canvas");
        canvas.width = largestDim;
        canvas.height = largestDim;

        canvas
          .getContext("2d")
          .drawImage(
            img,
            0,
            0,
            img.naturalWidth,
            img.naturalHeight,
            box.x,
            box.y,
            box.w,
            box.h
          );
        setImage(canvas);
      };
    }
  }, [imageURL]);

  // Offscreen canvas changed, draw it
  useEffect(() => {
    if (image) {
      const canvas = canvasEl.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  }, [image]);

  // Mask changed, draw original image and mask on top with some alpha
  useEffect(() => {
    if (mask) {
      const canvas = canvasEl.current;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      ctx.globalAlpha = 0.7;
      ctx.drawImage(
        mask,
        0,
        0,
        mask.width,
        mask.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      ctx.globalAlpha = 1;
    }
  }, [mask, image]);

  // Add after imageClick function
  const handleAddText = () => {
    if (!mask) return;

    const canvas = canvasEl.current;
    const newText = {
      id: Date.now(),
      text: "New Text",
      x: 0,
      y: 24,
      depth: 50,
      fontSize: 24,
      fontFamily: FONTS.FORUM,
      strokeWidth: 4,
      opacity: 1,
      fillColor: "#ffffff",
      strokeColor: "#000000",
      shadowBlur: 2,
      shadowColor: "rgba(0,0,0,0.5)",
      letterSpacing: 0,
      lineHeight: 1.2
    };

    setTextLayers([...textLayers, newText]);
  };

  // Auto encode when image loads
  useEffect(() => {
    if (image && !imageEncoded && !loading) {
      encodeImageClick();
    }
  }, [image, imageEncoded, loading]);

  const handleMouseDown = (event) => {
    const canvas = canvasEl.current;
    const { x, y } = convertCoordinates(event.clientX, event.clientY, canvas, { w: canvas.width, h: canvas.height });

    // Check for resize handles first
    const resizeHandleClicked = textLayers.find(layer => {
      if (selectedText?.id !== layer.id) return false;

      const ctx = canvas.getContext("2d");
      ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
      const metrics = ctx.measureText(layer.text);
      const textHeight = layer.fontSize;
      const padding = 10;
      const handleSize = 8; // Slightly bigger than visual size for easier clicking

      const handles = [
        { x: layer.x - padding, y: layer.y - textHeight - padding, pos: 'tl' },
        { x: layer.x + metrics.width + padding, y: layer.y - textHeight - padding, pos: 'tr' },
        { x: layer.x - padding, y: layer.y + padding, pos: 'bl' },
        { x: layer.x + metrics.width + padding, y: layer.y + padding, pos: 'br' }
      ];

      const clickedHandle = handles.find(handle =>
        Math.abs(x - handle.x) <= handleSize &&
        Math.abs(y - handle.y) <= handleSize
      );

      if (clickedHandle) {
        setResizeHandle(clickedHandle.pos);
        return true;
      }
      return false;
    });

    if (resizeHandleClicked) {
      handleResizeStart(event, resizeHandleClicked);
      return;
    }

    // Find if we clicked on any text
    const clickedText = textLayers.find(layer => {
      const ctx = canvas.getContext("2d");
      ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
      const metrics = ctx.measureText(layer.text);
      const textHeight = layer.fontSize;
      // Increased hit area: wider and taller bounds
      const padding = 20;
      return (
        x >= layer.x - padding &&
        x <= layer.x + metrics.width + padding &&
        y >= layer.y - textHeight - padding &&
        y <= layer.y + padding
      );
    });

    if (clickedText) {
      setIsDragging(true);
      dragStart.current = { x, y };
      draggedText.current = clickedText;
      setSelectedText(clickedText);
      event.preventDefault();
    }
  };

  const handleMouseMove = (event) => {
    if (isResizing) {
      handleResizeMove(event);
      return;
    }

    if (!isDragging || !draggedText.current) return;

    const canvas = canvasEl.current;
    const { x, y } = convertCoordinates(event.clientX, event.clientY, canvas, { w: canvas.width, h: canvas.height });

    const dx = x - dragStart.current.x;
    const dy = y - dragStart.current.y;

    setTextLayers(layers =>
      layers.map(layer =>
        layer.id === draggedText.current.id
          ? {
            ...layer,
            x: layer.x + dx,
            y: layer.y + dy
          }
          : layer
      )
    );

    dragStart.current = { x, y };
  };

  const handleMouseUp = (event) => {
    if (isResizing) {
      handleResizeEnd();
      event.stopPropagation();
      event.preventDefault();
      setBlockMaskClick(true);
      setTimeout(() => setBlockMaskClick(false), 500);
      return;
    }

    if (isDragging) {
      event.stopPropagation();
      event.preventDefault();
      setBlockMaskClick(true);
      setTimeout(() => setBlockMaskClick(false), 500); // Block mask clicks for 500ms after drag
    }
    setIsDragging(false);
    draggedText.current = null;
  };

  // Update text layer effect
  useEffect(() => {
    if (mask && canvasEl.current && !isDragging && !isResizing && loadedFonts.size > 0) {
      const canvas = canvasEl.current;
      const ctx = canvas.getContext("2d");
      const maskCtx = mask.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Clear and draw base image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // 2. Draw all text layers with enhanced styling
      textLayers.forEach(layer => {
        ctx.font = `${FONT_WEIGHTS.MEDIUM} ${layer.fontSize}px ${layer.fontFamily}`;
        ctx.textBaseline = 'alphabetic';
        ctx.textRendering = 'optimizeLegibility';
        ctx.letterSpacing = `${layer.letterSpacing}px`;
        const metrics = ctx.measureText(layer.text);
        const textHeight = layer.fontSize * layer.lineHeight;
        const padding = 10;

        // Set global opacity for the text
        ctx.globalAlpha = layer.opacity;

        // Enable better text rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Add shadow for smoother edges
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowColor = layer.shadowColor;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw text with improved quality
        if (layer.strokeWidth > 0) {
          // Draw multiple strokes for better quality
          const strokePasses = 3;
          const baseWidth = layer.strokeWidth / strokePasses;

          for (let i = 0; i < strokePasses; i++) {
            ctx.lineWidth = baseWidth;
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(layer.text, layer.x, layer.y);
          }
        }

        // Draw text fill with multiple passes for better anti-aliasing
        ctx.fillStyle = layer.fillColor;
        ctx.fillText(layer.text, layer.x, layer.y);

        // Second pass with slight offset for better edge smoothing
        ctx.globalAlpha = layer.opacity * 0.4;
        ctx.fillText(layer.text, layer.x + 0.5, layer.y + 0.5);
        ctx.globalAlpha = layer.opacity;

        // Reset shadow and other effects
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = 1;

        // Draw selection box and handles if text is selected
        if (selectedText?.id === layer.id) {
          // Draw box
          if (showBorder) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#2563eb";
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(
              layer.x - padding,
              layer.y - textHeight - padding,
              metrics.width + padding * 2,
              textHeight + padding * 2
            );
            ctx.setLineDash([]);
          }

          // Draw corner handles
          const handleSize = 6;
          const handles = [
            { x: layer.x - padding, y: layer.y - textHeight - padding }, // Top-left
            { x: layer.x + metrics.width + padding, y: layer.y - textHeight - padding }, // Top-right
            { x: layer.x - padding, y: layer.y + padding }, // Bottom-left
            { x: layer.x + metrics.width + padding, y: layer.y + padding }, // Bottom-right
          ];

          handles.forEach(handle => {
            ctx.fillStyle = "#2563eb";
            ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          });
        }
      });

      // 3. Create a temporary canvas for the masked object
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Draw the original image on temp canvas
      tempCtx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Apply the mask to temp canvas
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(
        mask,
        0,
        0,
        mask.width,
        mask.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // 4. Draw the masked object on top of everything
      ctx.drawImage(tempCanvas, 0, 0);

      // Draw mask border if enabled and mask exists
      if (showBorder && mask && maskCtx.getImageData(0, 0, mask.width, mask.height).data.some(x => x > 0)) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563eb";
        ctx.setLineDash([6, 4]);

        // Get mask bounds
        const imageData = maskCtx.getImageData(0, 0, mask.width, mask.height);
        const data = imageData.data;
        let left = mask.width;
        let right = 0;
        let top = mask.height;
        let bottom = 0;
        let hasMask = false;

        for (let y = 0; y < mask.height; y++) {
          for (let x = 0; x < mask.width; x++) {
            const idx = (y * mask.width + x) * 4;
            if (data[idx + 3] > 0) { // If pixel is not fully transparent
              hasMask = true;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
        }

        ctx.setLineDash([]);
      }

      // Draw mask overlay if enabled
      if (showMask) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(
          mask,
          0,
          0,
          mask.width,
          mask.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        ctx.globalAlpha = 1;
      }
    }
  }, [mask, image, textLayers, showMask, isDragging, isResizing, selectedText, showBorder, loadedFonts]);

  // Add simple text drawing during drag
  useEffect(() => {
    if (isDragging && image && canvasEl.current) {
      const canvas = canvasEl.current;
      const ctx = canvas.getContext("2d");

      // Clear and draw base image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Draw all text without masking during drag
      textLayers.forEach(layer => {
        ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "black";
        ctx.strokeText(layer.text, layer.x, layer.y);
        ctx.fillStyle = "white";
        ctx.fillText(layer.text, layer.x, layer.y);
      });
    }
  }, [isDragging, textLayers, image]);

  // Update reset handler
  const handleResetMask = () => {
    resetMask();
    setSelectedObject(null);

    // Redraw canvas with just the image and text
    const canvas = canvasEl.current;
    const ctx = canvas.getContext("2d");

    // Clear and draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Draw all text without masking
    textLayers.forEach(layer => {
      ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "black";
      ctx.strokeText(layer.text, layer.x, layer.y);
      ctx.fillStyle = "white";
      ctx.fillText(layer.text, layer.x, layer.y);
    });
  };

  // Add resize handlers
  const handleResizeStart = (event, layer) => {
    event.stopPropagation();
    event.preventDefault();
    setIsResizing(true);

    const canvas = canvasEl.current;
    const ctx = canvas.getContext("2d");
    ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`;
    const metrics = ctx.measureText(layer.text);

    resizeStart.current = {
      x: event.clientX,
      y: event.clientY,
      fontSize: layer.fontSize,
      width: metrics.width,
      textX: layer.x,
      textY: layer.y
    };
    resizingText.current = layer;
    setSelectedText(layer);
  };

  const handleResizeMove = (event) => {
    if (!isResizing || !resizingText.current) return;

    const dx = event.clientX - resizeStart.current.x;
    const dy = event.clientY - resizeStart.current.y;
    const isLeft = resizeHandle.includes('l');
    const isTop = resizeHandle.includes('t');

    // Calculate scale based on width change
    const widthChange = isLeft ? -dx : dx;
    const scale = (resizeStart.current.width + widthChange) / resizeStart.current.width;
    const newSize = Math.max(1, resizeStart.current.fontSize * scale); // Remove upper limit

    // Calculate new position based on handle
    let newX = resizeStart.current.textX;
    let newY = resizeStart.current.textY;

    if (isLeft) {
      newX = resizeStart.current.textX + dx;
    }
    if (isTop) {
      newY = resizeStart.current.textY + dy;
    }

    setTextLayers(layers =>
      layers.map(layer =>
        layer.id === resizingText.current.id
          ? {
            ...layer,
            fontSize: newSize,
            x: newX,
            y: newY
          }
          : layer
      )
    );

    if (selectedText?.id === resizingText.current.id) {
      setSelectedText(prev => ({
        ...prev,
        fontSize: newSize,
        x: newX,
        y: newY
      }));
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeHandle(null);
    resizingText.current = null;
  };

  // Add cursor helper function
  const getResizeCursor = (handle) => {
    if (!handle) return 'default';
    switch (handle) {
      case 'tl':
      case 'br':
        return 'nwse-resize';
      case 'tr':
      case 'bl':
        return 'nesw-resize';
      default:
        return 'default';
    }
  };

  // Update export function to use existing canvas
  const exportTextOnly = (format) => {
    // Store current states
    const currentShowMask = showMask;
    const currentShowBorder = showBorder;
    const currentSelectedText = selectedText;

    // Temporarily hide UI elements
    setShowMask(false);
    setShowBorder(false);
    setSelectedText(null);

    // Wait for the next render cycle
    setTimeout(() => {
      // Get the current canvas state
      const dataUrl = canvasEl.current.toDataURL(`image/${format}`);

      // Create and trigger download
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `text_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Restore previous states
      setShowMask(currentShowMask);
      setShowBorder(currentShowBorder);
      setSelectedText(currentSelectedText);
    }, 100); // Small delay to ensure the render cycle completes
  };

  // Update font family change handler
  const handleFontChange = (newFont) => {
    if (!loadedFonts.has(newFont)) return; // Don't change if font not loaded
    setTextLayers(layers =>
      layers.map(l => l.id === selectedText.id ? { ...l, fontFamily: newFont } : l)
    );
    setSelectedText(prev => ({ ...prev, fontFamily: newFont }));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-[1400px]">
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open("https://github.com/Hormold/text-behind", "_blank")
            }
          >
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
          </Button>
        </div>
        <CardHeader>
          <CardTitle>
            <div className="flex flex-col gap-2">
              <p>
                Clientside Image Segmentation with onnxruntime-web and Meta's SAM2
              </p>
              <p
                className={cn(
                  "flex gap-1 items-center",
                  device ? "visible" : "invisible"
                )}
              >
                <Fan
                  color="#000"
                  className="w-6 h-6 animate-[spin_2.5s_linear_infinite] direction-reverse"
                />
                Running on {device}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Toolbar
              loading={loading}
              status={status}
              showMask={showMask}
              setShowMask={setShowMask}
              showBorder={showBorder}
              setShowBorder={setShowBorder}
              mask={mask}
              handleResetMask={handleResetMask}
              handleFileUpload={handleFileUpload}
              setInputDialogOpen={setInputDialogOpen}
              cropClick={cropClick}
              exportTextOnly={exportTextOnly}
              textLayers={textLayers}
              fileInputEl={fileInputEl}
              encodeImageClick={encodeImageClick}
              imageEncoded={imageEncoded}
            />

            <div className="flex gap-8">
              <div className="flex-1">
                <QuickGuide />
                <canvas
                  ref={canvasEl}
                  width={768}
                  height={768}
                  onClick={imageClick}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!isDragging) {
                      imageClick(event);
                    }
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    cursor: isDragging
                      ? 'grabbing'
                      : isResizing
                        ? getResizeCursor(resizeHandle)
                        : 'default',
                    width: '100%',
                    height: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem'
                  }}
                />
              </div>

              <TextEditor
                textLayers={textLayers}
                selectedText={selectedText}
                setSelectedText={setSelectedText}
                setTextLayers={setTextLayers}
                handleAddText={handleAddText}
                mask={mask}
                loadedFonts={loadedFonts}
                handleFontChange={handleFontChange}
              />
            </div>
          </div>
        </CardContent>
        <div className="flex flex-col p-4 gap-2">
          <Button onClick={handleRequestStats} variant="secondary">
            Print stats
          </Button>
          <pre className="p-4 border-gray-600 bg-gray-100">
            {stats != null && JSON.stringify(stats, null, 2)}
          </pre>
        </div>
      </Card>
      <InputDialog
        open={inputDialogOpen}
        setOpen={setInputDialogOpen}
        submitCallback={handleUrl}
        defaultURL={inputDialogDefaultURL}
      />
      <input
        ref={fileInputEl}
        hidden="True"
        accept="image/*"
        type='file'
        onInput={handleFileUpload}
      />
      <Analytics />
    </div>
  );
}
