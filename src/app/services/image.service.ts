import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ImageService {
    constructor() { }

    // Resize an image file to a png blob.
    // Keeps the aspect ratio and does not upscale.
    async resizeImageToPngBlob(
        file: File,
        maxWidth: number,
        maxHeight: number
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = () => {
                img.src = reader.result as string;
            };

            img.onload = () => {
                const { width: origWidth, height: origHeight } = img;

                // Calculate new dimensions while preserving aspect ratio
                let newWidth = origWidth;
                let newHeight = origHeight;

                const widthRatio = maxWidth / origWidth;
                const heightRatio = maxHeight / origHeight;
                const scale = Math.min(widthRatio, heightRatio, 1); // Prevent upscaling

                newWidth = Math.floor(origWidth * scale);
                newHeight = Math.floor(origHeight * scale);

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context not available'));

                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // Convert canvas to PNG blob
                canvas.toBlob(
                    blob => {
                        if (blob) resolve(blob);
                        else reject(new Error('Failed to convert canvas to blob'));
                    },
                    'image/png',
                    1.0
                );
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Resize an image file to a png blob.
    // Keeps the aspect ratio and does not upscale.
    async resizeImageToDataUrl(
        file: File,
        maxWidth: number,
        maxHeight: number
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = () => {
                img.src = reader.result as string;
            };

            img.onload = () => {
                const { width: origWidth, height: origHeight } = img;

                // Calculate new dimensions while preserving aspect ratio
                let newWidth = origWidth;
                let newHeight = origHeight;

                const widthRatio = maxWidth / origWidth;
                const heightRatio = maxHeight / origHeight;
                const scale = Math.min(widthRatio, heightRatio, 1); // Prevent upscaling

                newWidth = Math.floor(origWidth * scale);
                newHeight = Math.floor(origHeight * scale);

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context not available'));

                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // Convert canvas to PNG url
                resolve(canvas.toDataURL('image/png'));
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
}
