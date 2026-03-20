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
        if (window.onImagesLoaded) {
            window.onImagesLoaded(count);
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
                    if (window.onImageData) {
                        window.onImageData(index, base64);
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

    window.downloadImage = function(base64, filename) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/jpeg'});
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
});
