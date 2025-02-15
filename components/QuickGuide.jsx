import React from 'react';

export const QuickGuide = () => (
	<div className="mb-4 text-sm text-muted-foreground">
		<p><strong>Quick Guide:</strong></p>
		<ol className="list-decimal list-inside space-y-1">
			<li>Enable "Show Mask" and click on an object you want to add text to</li>
			<li>Hold Shift and click multiple times to merge masks</li>
			<li>Click "Add Text" button on the right</li>
			<li>Disable "Show Mask" to see your text clearly</li>
			<li>Drag text to position, use corner handles to resize</li>
			<li>Edit text content and style in the right panel</li>
		</ol>
	</div>
); 