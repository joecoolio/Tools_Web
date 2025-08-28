import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ImageService {
    constructor() { }

    // Resize an image file to a png blob.
    // Keeps the aspect ratio and does not upscale.
    resizeImageToPngBlob(file: File, maxWidth: number, maxHeight: number): Observable<Blob> {
        return new Observable<Blob>(observer => {
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
                if (!ctx) {
                    observer.error(new Error('Canvas context not available'));
                    return;
                }

                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // Convert canvas to PNG blob
                canvas.toBlob(
                    blob => {
                        if (blob) {
                            observer.next(blob);
                            observer.complete();
                        } else {
                            observer.error(new Error('Canvas toBlob() failed'));
                        }
                    },
                    'image/png',
                    1.0
                );
            };

            reader.onerror = err => observer.error(err);
            
            reader.readAsDataURL(file);
        });
    }

    // Resize an image file to a png blob.
    // Keeps the aspect ratio and does not upscale.
    resizeImageToDataUrl(file: File, maxWidth: number, maxHeight: number): Observable<string> {
        return new Observable<string>(observer => {
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
                if (!ctx) {
                    observer.error(new Error('Canvas context not available'));
                    return;
                }

                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // Convert canvas to PNG url
                observer.next(canvas.toDataURL('image/png'));
                observer.complete();
            };

            reader.onerror = err => observer.error(err);

            reader.readAsDataURL(file);
        });
    }
}
