import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, map, Observable, of, tap } from 'rxjs';
import { TokenService } from './token.service';
import { Injectable } from '@angular/core';
import { API_URL } from '../app.component';
import { BoundedMap } from './boundedmap';
import { SafeUrl } from '@angular/platform-browser';

// URLs
const URL_MY_INFO = API_URL + 'v1/myinfo';
const URL_RELOAD_FRIENDS = API_URL + 'v1/reloadfriends';
const URL_FRIENDS = API_URL + 'v1/friends';
const URL_ALL_NEIGHBORS = API_URL + 'v1/getneighbors';
const URL_GET_NEIGHBOR = API_URL + 'v1/getneighbor';
const URL_ADD_FRIENDSHIP = API_URL + 'v1/addfriendship';
const URL_REMOVE_FRIENDSHIP = API_URL + 'v1/removefriendship';
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
    home_address: string,
    distance_m: number,
    depth: number,
    is_friend: boolean,
    imageUrl: SafeUrl | undefined,
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

    // Caches
    private neighborCache: BoundedMap<number, Neighbor> = new BoundedMap(100);
    private toolCache: BoundedMap<number, Tool> = new BoundedMap(100);
    private photoCache: BoundedMap<string, Blob> = new BoundedMap(100);

    // Get my info
    async getMyInfo(): Promise<MyInfo> {
        return await firstValueFrom(
            this.http.post<MyInfo>(
                URL_MY_INFO,
                {},
                {},
            )
        );   
    }

    // Reload friends from the DB.
    // Since the server stores your friend list, if you change it you must re-call this.
    async reloadfriends(): Promise<string> {
        return await firstValueFrom(
            this.http.post<string>(
                URL_RELOAD_FRIENDS,
                {},
                {},
            )
        );
    }

    // Get my friends.
    // If the friend is already in the cache, return that object but updated.
    // Put anything new in the neighbor cache.
    async getFriends(depth: number = 999): Promise<Neighbor[]> {
        const body = {
            depth: depth
        };
        return await firstValueFrom(
            this._getNeighbors(URL_FRIENDS, body)
            .pipe(
                // Add the 'is_friend = true' property to each friend
                map((neighbors: Neighbor[]) => neighbors.map(neighbor => ({
                    ...neighbor,
                    is_friend: true,
                })))
            )
        );
    }

    // List neighbors (not friends) within some radius of me
    async listNeighbors(radiusMiles: number = 100): Promise<Neighbor[]> {
        const body = {
            radius_miles: radiusMiles
        };
        return await firstValueFrom(
            this._getNeighbors(URL_ALL_NEIGHBORS, body)
            .pipe(
                // Add the 'is_friend = false' property to each friend
                map((neighbors: Neighbor[]) => neighbors.map(neighbor => ({
                    ...neighbor,
                    is_friend: false,
                })))
            )

        );
    }

    // Get my set of neighbors.
    // If the neighbor is already in the cache, return that object but updated.
    // Otherwise add it to the cache.
    private _getNeighbors(url: string, body: any|null): Observable<Neighbor[]> {
        return this.http.post<Neighbor[]>(
            url,
            body,
            {},
        )
        .pipe(
            // Handle cached versions
            map((neighbors: Neighbor[]) => neighbors.map(neighbor => this._getCachedVersionOfNeighbor(neighbor)))
        );
    }

    // If the neighbor is already cached, return the existing object instead of a new one.
    // If it's a new neighbor, cache it
    private _getCachedVersionOfNeighbor(neighbor: Neighbor): Neighbor {
        const oldNeighbor: Neighbor | undefined = this.neighborCache.getWithoutReinsert(neighbor.id);
        if (oldNeighbor) {
            Object.assign(oldNeighbor, neighbor);
            return oldNeighbor;
        } else {
            this.neighborCache.set(neighbor.id, neighbor);
            return neighbor;
        }
    }

    // Get a single neighbor
    // Put in the neighbor cache
    async getNeighbor(id: number): Promise<Neighbor> {
        if (this.neighborCache.has(id)) {
            return await firstValueFrom(of(this.neighborCache.get(id)!));
        } else {
            const body = {
                neighborId: id
            };
            return await firstValueFrom(
                this.http.post<Neighbor>(
                    URL_GET_NEIGHBOR,
                    body,
                    {},
                )
                .pipe(tap(neighbor => this._getCachedVersionOfNeighbor(neighbor)))
            );
        }
    }

    // Get a neighbor's picture
    async getPicture(photo_id: string): Promise<Blob> {
        if (this.photoCache.has(photo_id)) {
            return await firstValueFrom(of(this.photoCache.get(photo_id)!));
        } else {
            // console.log("API - Getting picture: " + photo_id);
            const body = {
                photo_id: photo_id
            };

            return await firstValueFrom(
                this.http.post(
                    URL_GET_PICTURE,
                    body,
                    { observe: 'body', responseType: "blob" },
                )
                .pipe(tap(data => this.photoCache.set(photo_id, data)))
            );
        }
    }

    // Create a friendship from me to another person.
    // You need to call reloadFriends() after this.
    async createFriendship(neighborId: number): Promise<void> {
        const body = {
            neighborId: neighborId
        };
        return await firstValueFrom(
            this.http.post<void>(
                URL_ADD_FRIENDSHIP,
                body,
                {},
            )
        );
    }

    // Remove a friendship from me to another person.
    // You need to call reloadFriends() after this.
    async removeFriendship(neighborId: number): Promise<void> {
        const body = {
            neighborId: neighborId
        };
        return await firstValueFrom(
            this.http.post<void>(
                URL_REMOVE_FRIENDSHIP,
                body,
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

    // Get details about single tool
    async getTool(id: number): Promise<Tool> {
        if (this.toolCache.has(id)) {
            return await firstValueFrom(of(this.toolCache.get(id)!));
        } else {
            // console.log("API - Getting tool: " + id);
            const body = {
                id: id
            };
            return await firstValueFrom(
                this.http.post<Tool>(
                    URL_GET_TOOL,
                    body,
                    {}
                )
                .pipe(tap(data => this.toolCache.set(id, data)))
            );
        }
    };

}

