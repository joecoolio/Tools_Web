import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TokenService } from './token.service';
import { Injectable } from '@angular/core';
import { API_URL } from '../app.component';

// URLs
const URL_ALL_NEGHBORS = API_URL + 'v1/getneighbors';
const URL_ALL_TOOLS = API_URL + 'v1/getalltools';

// Timeout for remote calls
const HTTP_TIMEOUT: number = 5000;

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

// Data for the current user
export interface MyInfo {
    home_address: string,
    latitude: number,
    longitude: number,
}

// Data for a neighbor
export interface Neighbor {
    id: number,
    name: string,
    latitude: number,
    longitude: number,
    distance_m: number,
    is_friend: boolean,
}

// Data for a tool
export interface Tool {
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
export class DataService {
    constructor(private http: HttpClient, private tokenStorage: TokenService) { }

    // Get my info
    async getMyInfo(): Promise<MyInfo> {
        return await firstValueFrom(
            this.http.post<MyInfo>(
                API_URL + 'v1/myinfo',
                {},
                {},
            )
        );   
    }

    // List neighbors
    async listNeighbors(): Promise<Neighbor[]> {
        return await firstValueFrom(
            this.http.post<Neighbor[]>(
                API_URL + 'v1/getneighbors',
                {},
                {},
            )
        );   
    }

    // Get all available tools
    async getAllTools(): Promise<Tool[]> {
        const body = {};

        return await firstValueFrom(
            this.http.post<Tool[]>(
                URL_ALL_TOOLS,
                body,
                {}
            )
        );
    }

}

