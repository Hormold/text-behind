import React from 'react';
import { Button } from "@/components/ui/button";
import { LoaderCircle, Eraser, ImageUp, ImageDown } from "lucide-react";

export const Toolbar = ({
	loading,
	status,
	showMask,
	setShowMask,
	showBorder,
	setShowBorder,
	mask,
	handleResetMask,
	handleFileUpload,
	setInputDialogOpen,
	cropClick,
	exportTextOnly,
	textLayers,
	fileInputEl,
	encodeImageClick,
	imageEncoded
}) => (
	<div className="flex justify-between items-center gap-4 border-b pb-4">
		<div className="flex gap-2">
			<Button
				onClick={encodeImageClick}
				disabled={loading || imageEncoded}
			>
				<p className="flex items-center gap-2">
					{loading && <LoaderCircle className="animate-spin w-6 h-6" />}
					{status}
				</p>
			</Button>
			<Button
				onClick={() => setShowMask(!showMask)}
				variant={showMask ? "default" : "secondary"}>
				Show Mask
			</Button>
			<Button
				onClick={() => setShowBorder(!showBorder)}
				variant={showBorder ? "default" : "secondary"}>
				Show Border
			</Button>
			<Button
				onClick={handleResetMask}
				variant="secondary"
				disabled={!mask}>
				<Eraser className="w-4 h-4 mr-2" /> Reset Mask
			</Button>
		</div>
		<div className="flex gap-2">
			<Button
				onClick={() => { fileInputEl.current.click() }}
				variant="secondary"
				disabled={loading}>
				<ImageUp className="mr-2" /> Upload Image
			</Button>
			<Button
				onClick={() => { setInputDialogOpen(true) }}
				variant="secondary"
				disabled={loading}
			>
				<ImageUp className="mr-2" /> From URL
			</Button>
			<Button
				onClick={cropClick}
				disabled={mask == null}
				variant="secondary">
				<ImageDown className="mr-2" /> Export Mask
			</Button>
			<Button
				onClick={() => exportTextOnly('png')}
				disabled={textLayers.length === 0}
				variant="secondary">
				<ImageDown className="mr-2" /> PNG
			</Button>
			<Button
				onClick={() => exportTextOnly('jpeg')}
				disabled={textLayers.length === 0}
				variant="secondary">
				<ImageDown className="mr-2" /> JPEG
			</Button>
		</div>
	</div>
); 