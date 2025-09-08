// global-values.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalValuesService {
    // List of radii in dropdown for browsing tools
    public readonly browseRadii:{value: number, text: string}[] = [
        { value: .25, text: "1/4 Mile" },
        { value: .5, text: "1/2 Mile" },
        { value: 1, text: "1 Mile" },
        { value: 2, text: "2 Miles" },
        { value: 5, text: "5 Miles" },
        { value: 10, text: "10 Miles" },
        { value: 20, text: "20 Miles" },
        { value: 9999, text: "Unlimited" },
    ];
}