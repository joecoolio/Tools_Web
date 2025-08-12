import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { TokenService } from './token.service';
import { Injectable } from '@angular/core';
import { API_URL } from '../app.component';

// URLs
const URL_MY_INFO = API_URL + 'v1/myinfo';
const URL_ALL_NEIGHBORS = API_URL + 'v1/getneighbors';
const URL_GET_NEIGHBOR = API_URL + 'v1/getneighbor';
const URL_ALL_TOOLS = API_URL + 'v1/getalltools';
const URL_GET_TOOL = API_URL + 'v1/gettool';
const URL_GET_PICTURE = API_URL + 'v1/getImage';

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
    photo_link: string,
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
                URL_ALL_NEIGHBORS,
                {},
                {},
            )
        );   
    }

    // List neighbors
    async getNeighbor(id: number): Promise<Neighbor> {
        const body = {
            neighborId: id
        };

        return await firstValueFrom(
            this.http.post<Neighbor>(
                URL_GET_NEIGHBOR,
                body,
                {},
            )
        );
    }

    // Get a neighbor's picture
    async getPicture(photo_id: string): Promise<Blob> {
        console.log("Getting picture: " + photo_id);
        const body = {
            photo_id: photo_id
        };

        return await firstValueFrom(
            this.http.post(
                URL_GET_PICTURE,
                body,
                { observe: 'body', responseType: "blob" },
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

    // Get details about single tool
    async getTool(id: number): Promise<Tool> {
        const body = {
            id: id
        };

        return await firstValueFrom(
            this.http.post<Tool>(
                URL_GET_TOOL,
                body,
                {}
            )
        );
    };

}

