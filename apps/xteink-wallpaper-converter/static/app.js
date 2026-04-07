document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone) {
        dropZone.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                fileInput.click();
            }
        });

        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });
    }

    window.loadImages = function(files) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff'));
        const count = imageFiles.length;

        // Check if this looks like a directory upload (files with different parent paths)
        let isDirectory = false;
        if (count > 1) {
            const paths = imageFiles.map(f => f.webkitRelativePath || f.name);
            const uniquePaths = new Set(paths.map(p => p.split('/').slice(0, -1).join('/')));
            isDirectory = uniquePaths.size > 1 || (uniquePaths.size === 1 && [...uniquePaths][0] !== '');
        }

        if (window.onImagesLoaded) {
            window.onImagesLoaded(count, isDirectory);
        }

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];

            const reader = new FileReader();
            reader.onload = (function(index) {
                return function(e) {
                    if (!e.target.result) {
                        if (window.onImageLoadError) {
                            window.onImageLoadError(index, file.name, 'empty result');
                        }
                        return;
                    }
                    const parts = e.target.result.split(',');
                    if (parts.length < 2) {
                        if (window.onImageLoadError) {
                            window.onImageLoadError(index, file.name, 'invalid data url');
                        }
                        return;
                    }
                    const base64 = parts[1];
                    const filename = file.name;
                    if (window.onImageData) {
                        window.onImageData(index, filename, base64);
                    }
                };
            })(i);
            reader.onerror = (function(index) {
                return function() {
                    if (window.onImageLoadError) {
                        window.onImageLoadError(index, file.name, 'file read error');
                    }
                };
            })(i);
            reader.readAsDataURL(file);
        }
    };

    window.handleFiles = window.loadImages;

    window.downloadImage = function(base64, filename, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        let type = 'application/octet-stream';
        if (mimeType) {
            type = mimeType;
        } else if (filename.toLowerCase().endsWith('.bmp')) {
            type = 'image/bmp';
        } else if (filename.toLowerCase().endsWith('.zip')) {
            type = 'application/zip';
        }

        const blob = new Blob([byteArray], {type: type});
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up URL object after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // Crop selection functionality
    let isDragging = false;
    let startX, startY;
    let selectionBox = null;

    document.addEventListener('mousedown', function(e) {
        if (e.target.id === 'preview-image') {
            e.preventDefault();
            isDragging = true;
            const rect = e.target.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;

            selectionBox = document.getElementById('crop-selection');
            if (selectionBox) {
                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                selectionBox.style.display = 'block';
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (isDragging && selectionBox) {
            e.preventDefault();
            const img = document.getElementById('preview-image');
            if (img) {
                const rect = img.getBoundingClientRect();
                const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);

                // Maintain 480x800 aspect ratio (0.6)
                const aspectRatio = 480 / 800;
                const constrainedHeight = width / aspectRatio;
                const constrainedWidth = height * aspectRatio;

                let finalWidth, finalHeight;
                if (constrainedHeight <= height) {
                    finalWidth = width;
                    finalHeight = constrainedHeight;
                } else {
                    finalWidth = constrainedWidth;
                    finalHeight = height;
                }

                // Ensure selection stays within image bounds
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                finalWidth = Math.min(finalWidth, rect.width - left);
                finalHeight = Math.min(finalHeight, rect.height - top);

                selectionBox.style.left = left + 'px';
                selectionBox.style.top = top + 'px';
                selectionBox.style.width = finalWidth + 'px';
                selectionBox.style.height = finalHeight + 'px';
            }
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (isDragging && selectionBox) {
            e.preventDefault();
            isDragging = false;

            // Send crop coordinates back to Go (relative to preview image natural size)
            const img = document.getElementById('preview-image');
            if (img && window.onCropSelection) {
                // Get the displayed size vs natural size scaling
                const rect = img.getBoundingClientRect();
                const displayWidth = rect.width;
                const displayHeight = rect.height;
                const naturalWidth = img.naturalWidth;
                const naturalHeight = img.naturalHeight;

                const scaleX = naturalWidth / displayWidth;
                const scaleY = naturalHeight / displayHeight;

                const cropX = parseFloat(selectionBox.style.left) * scaleX;
                const cropY = parseFloat(selectionBox.style.top) * scaleY;
                const cropWidth = parseFloat(selectionBox.style.width) * scaleX;
                const cropHeight = parseFloat(selectionBox.style.height) * scaleY;

                window.onCropSelection(Math.round(cropX), Math.round(cropY), Math.round(cropWidth), Math.round(cropHeight));
            }
        }
    });
});
