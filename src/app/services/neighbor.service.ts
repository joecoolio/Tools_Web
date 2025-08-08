import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TokenService } from './token.service';
import { Injectable } from '@angular/core';
import { API_URL } from '../app.component';

// Timeout for remote calls
const HTTP_TIMEOUT: number = 5000;

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

export interface Neighbor {
    id: number,
    name: string,
    latitude: number,
    longitude: number,
    distance_m: number,
}

@Injectable({
  providedIn: 'root'
})
export class NeighborService {
    constructor(private http: HttpClient, private tokenStorage: TokenService) { }

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
}
