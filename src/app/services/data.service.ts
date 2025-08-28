import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, iif, map, Observable, of, tap } from 'rxjs';
import { TokenService } from './token.service';
import { Injectable } from '@angular/core';
import { BoundedMap } from './boundedmap';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment'

// URLs
const API_URL = environment.baseUrl;
const URL_MY_INFO = API_URL + 'v1/myinfo';
const URL_VALIDATE_ADDRESS = API_URL + 'v1/validateaddress';
const URL_UPDATE_MY_INFO = API_URL + 'v1/updateinfo';
const URL_RELOAD_FRIENDS = API_URL + 'v1/reloadfriends';
const URL_FRIENDS = API_URL + 'v1/friends';
const URL_ALL_NEIGHBORS = API_URL + 'v1/getneighbors';
const URL_GET_NEIGHBOR = API_URL + 'v1/getneighbor';
const URL_ADD_FRIENDSHIP = API_URL + 'v1/addfriendship';
const URL_REMOVE_FRIENDSHIP = API_URL + 'v1/removefriendship';
const URL_MY_TOOLS = API_URL + 'v1/getmytools'
const URL_ALL_TOOLS = API_URL + 'v1/getalltools';
const URL_GET_TOOL = API_URL + 'v1/gettool';
const URL_GET_PICTURE = API_URL + 'v1/getImage';
const URL_GET_TOOL_CATEGORIES = API_URL + 'v1/gettoolcategories';
const URL_UPDATE_TOOL = API_URL + 'v1/updatetool';
const URL_CREATE_TOOL = API_URL + 'v1/createtool';

// Timeout for remote calls
const HTTP_TIMEOUT: number = 5000;

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

// A basic http response holding only a success = true/false flag
export interface SuccessResult {
    result: boolean
}

// Parent object that has a photo_link and imageUrl.
// This makes it easy to load the image for various types of things.
export interface BaseImageObject {
    photo_link: string,
    imageUrl: SafeUrl | undefined, // Not pulled via api but will be filled in later as needed
}

// Data for the current user
export interface MyInfo extends BaseImageObject {
    userid: string,
    name: string,
    nickname: string,
    home_address: string,
    latitude: number,
    longitude: number,
}

// Data for a neighbor
export interface Neighbor extends BaseImageObject {
    id: number,
    name: string,
    latitude: number,
    longitude: number,
    home_address: string,
    distance_m: number,
    depth: number,
    is_friend: boolean,
}

// Data for a tool
export interface Tool extends BaseImageObject {
    id: number,
    owner_id: number,
    short_name: string,
    brand: string,
    name: string,
    product_url: string,
    replacement_cost: number,
    category_id: number,
    category: string,
    category_icon: string,
    latitude: number,
    longitude: number,
    distance_m: number,
}

// A tool category
export interface ToolCategory {
    id: number,
    name: string,
    icon: string,
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
    constructor(
        private http: HttpClient,
        private tokenStorage: TokenService,
        private sanitizer: DomSanitizer,
    ) { }

    // Caches
    private neighborCache: BoundedMap<number, Neighbor> = new BoundedMap(100);
    private toolCache: BoundedMap<number, Tool> = new BoundedMap(100);
    private photoCache: BoundedMap<string, Blob> = new BoundedMap(100);

    // Get my info
    getMyInfo(): Observable<MyInfo> {
        return this.http.post<MyInfo>(
            URL_MY_INFO,
            {},
            {},
        );   
    }

    // Validate an address
    validateAddress(address: string): Observable<boolean> {
        const body = {
            address: address
        };
        return this.http.post<SuccessResult>(
            URL_VALIDATE_ADDRESS,
            body,
            {},
        ).pipe(
            map((sr: SuccessResult) => sr.result)
        );
    }

    // Update my info
    updateMyInfo(formData: FormData): Observable<boolean> {
        return this.http.post<SuccessResult>(
            URL_UPDATE_MY_INFO,
            formData,
            {},
        ).pipe(
            map((sr: SuccessResult) => sr.result)
        );
    }

    // Reload friends from the DB.
    // Since the server stores your friend list, if you change it you must re-call this.
    reloadfriends(): Observable<string> {
        return this.http.post<string>(
            URL_RELOAD_FRIENDS,
            {},
            {},
        );
    }

    // Get my friends.
    // If the friend is already in the cache, return that object but updated.
    // Put anything new in the neighbor cache.
    getFriends(depth: number = 999): Observable<Neighbor[]> {
        const body = {
            depth: depth
        };
        return this._getNeighbors(URL_FRIENDS, body)
            .pipe(
                // Add the 'is_friend = true' property to each friend
                map((neighbors: Neighbor[]) => neighbors.map(neighbor => ({
                    ...neighbor,
                    is_friend: true,
                })))
            );
    }

    // List neighbors (not friends) within some radius of me
    listNeighbors(radiusMiles: number = 100): Observable<Neighbor[]> {
        const body = {
            radius_miles: radiusMiles
        };
        return this._getNeighbors(URL_ALL_NEIGHBORS, body)
            .pipe(
                // Add the 'is_friend = false' property to each friend
                map((neighbors: Neighbor[]) => neighbors.map(neighbor => ({
                    ...neighbor,
                    is_friend: false,
                })))
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
    getNeighbor(id: number): Observable<Neighbor> {
        if (this.neighborCache.has(id)) {
            return of(this.neighborCache.get(id)!);
        } else {
            const body = {
                neighborId: id
            };
            return this.http.post<Neighbor>(
                URL_GET_NEIGHBOR,
                body,
                {},
            )
            .pipe(tap(neighbor => this._getCachedVersionOfNeighbor(neighbor)))
            ;
        }
    }

    // Get a neighbor's picture
    getPicture(photo_id: string): Observable<Blob> {
        if (this.photoCache.has(photo_id)) {
            return of(this.photoCache.get(photo_id)!);
        } else {
            // console.log("API - Getting picture: " + photo_id);
            const body = {
                photo_id: photo_id
            };

            return this.http.post(
                URL_GET_PICTURE,
                body,
                { observe: 'body', responseType: "blob" },
            )
            .pipe(tap(data => this.photoCache.set(photo_id, data)));
        }
    }

    // Create a friendship from me to another person.
    // You need to call reloadFriends() after this.
    createFriendship(neighborId: number): Observable<void> {
        const body = {
            neighborId: neighborId
        };
        return this.http.post<void>(
            URL_ADD_FRIENDSHIP,
            body,
            {},
        );
    }

    // Remove a friendship from me to another person.
    // You need to call reloadFriends() after this.
    removeFriendship(neighborId: number): Observable<void> {
        const body = {
            neighborId: neighborId
        };
        return this.http.post<void>(
            URL_REMOVE_FRIENDSHIP,
            body,
            {},
        );
    }

    // Get all tool categories
    getToolCategories(): Observable<ToolCategory[]> {
        const body = {};

        return this.http.post<ToolCategory[]>(
            URL_GET_TOOL_CATEGORIES,
            body,
            {}
        );
    }
    
    // Get all of my tools
    getMyTools(): Observable<Tool[]> {
        const body = {};

        return this.http.post<Tool[]>(
            URL_MY_TOOLS,
            body,
            {}
        );
    }

    // Update a tool
    updateTool(formData: FormData): Observable<boolean> {
        // If .id is set, do an update / otherwise do a create
        const rawValue = formData.get('id');
        const numberValue = rawValue !== null ? parseFloat(rawValue.toString()) : 0;

        if (numberValue > 0) {
            return this.http.post<SuccessResult>(
                URL_UPDATE_TOOL,
                formData,
                {},
            ).pipe(
                map((sr: SuccessResult) => sr.result)
            );
        } else {
            return this.http.post<SuccessResult>(
                URL_CREATE_TOOL,
                formData,
                {},
            ).pipe(
                map((sr: SuccessResult) => sr.result)
            );
        }
    }

    // Get all available tools
    getAllTools(): Observable<Tool[]> {
        const body = {};

        return this.http.post<Tool[]>(
            URL_ALL_TOOLS,
            body,
            {}
        );
    }

    // Get details about single tool
    getTool(id: number): Observable<Tool> {
        if (this.toolCache.has(id)) {
            return of(this.toolCache.get(id)!);
        } else {
            // console.log("API - Getting tool: " + id);
            const body = {
                id: id
            };
            return this.http.post<Tool>(
                URL_GET_TOOL,
                body,
                {}
            )
            .pipe(tap(data => this.toolCache.set(id, data)));
        }
    };

    
    // Load up the image for some object.
    // Loads the image directly into the provided object.
    loadImageUrl(obj: BaseImageObject, defaultPhotoLink: string | undefined = undefined): Observable<void> {
        // Apply a default if needed
        if (! obj.photo_link && defaultPhotoLink) {
            obj.photo_link = defaultPhotoLink;
        }

        return iif(
            () => obj.photo_link != undefined,
            this.getPicture(obj.photo_link)
                .pipe(map(blob => {
                    const objectURL = URL.createObjectURL(blob);
                    obj.imageUrl = this.sanitizer.bypassSecurityTrustUrl(objectURL);
                })
            ),
            EMPTY
        );
    }
}

