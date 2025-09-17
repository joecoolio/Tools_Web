import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { NgxPicaService } from '@digitalascetic/ngx-pica';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
    constructor(private picaService: NgxPicaService) { }

    // Resize an image file to a png blob.
    // Keeps the aspect ratio and does not upscale.
    resizeImageToPngBlob(file: File, maxWidth: number, maxHeight: number): Observable<Blob> {
        return new Observable<Blob>(observer => {
            this.picaService.resizeImage(file, maxWidth, maxHeight).subscribe(resized => {
                observer.next(resized);
                observer.complete();
            })
        });
    }

    // Resize an image file to a png blob.
    // Keeps the aspect ratio and does not upscale.
    resizeImageToDataUrl(file: File, maxWidth: number, maxHeight: number): Observable<string> {
        return new Observable<string>(observer => {
            this.picaService.resizeImage(file, maxWidth, maxHeight).subscribe(resized => {
                let reader: FileReader = new FileReader();
                
                reader.onload = () => {
                    observer.next(reader.result as string);
                    observer.complete();
                }

                reader.readAsDataURL(resized);
            })
        });
    }
}
