import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TokenService } from './token.service';
import * as L from 'leaflet';
import { firstValueFrom, tap } from 'rxjs';

const URL_ALL_TOOLS = "http://localhost:8000/v1/getalltools";

export interface ToolResult {
    id: number,
    owner_id: number,
    name: string,
    product_url: string,
    replacement_cost: number,
    category: string,
    category_icon: string,
    latitude: number,
    longitude: number,
    distance_m: number
}

@Injectable({
  providedIn: 'root'
})
export class MarkerService {
    constructor(private http: HttpClient, private tokenStorage: TokenService) { }

    // Get all available tools
    async getAllTools(): Promise<ToolResult[]> {
        const body = {
        };

        return await firstValueFrom(
            this.http.post<ToolResult[]>(
                URL_ALL_TOOLS,
                body,
                {  }
            )
        );
    }

}
