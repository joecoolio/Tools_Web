import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, iif, map, Observable, of, tap } from 'rxjs';
import { effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { BoundedMap } from './boundedmap';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment'

// URLs
const API_URL = environment.baseUrl;
const URL_MY_INFO = API_URL + 'v1/myinfo';
const URL_VALIDATE_ADDRESS = API_URL + 'v1/validateaddress';
const URL_UPDATE_MY_INFO = API_URL + 'v1/updateinfo';
const URL_EXPIRE_FRIENDS = API_URL + 'v1/expirefriends';
const URL_FRIENDS = API_URL + 'v1/friends';
const URL_ALL_NEIGHBORS = API_URL + 'v1/getneighbors';
const URL_GET_NEIGHBOR = API_URL + 'v1/getneighbor';
const URL_REQ_FRIENDSHIP = API_URL + 'v1/requestfriendship';
const URL_CREATE_FRIENDSHIP = API_URL + 'v1/createfriendship';
const URL_CANCEL_FRIENDSHIP_REQ = API_URL + 'v1/deletefriendshiprequest';
const URL_REMOVE_FRIENDSHIP = API_URL + 'v1/removefriendship';
const URL_MY_TOOLS = API_URL + 'v1/getmytools'
const URL_ALL_TOOLS = API_URL + 'v1/getalltools';
const URL_GET_TOOL = API_URL + 'v1/gettool';
const URL_GET_PICTURE = API_URL + 'v1/getImage';
const URL_GET_TOOL_CATEGORIES = API_URL + 'v1/gettoolcategories';
const URL_UPDATE_TOOL = API_URL + 'v1/updatetool';
const URL_CREATE_TOOL = API_URL + 'v1/createtool';
const URL_GET_NOTIFICATIONS = API_URL + 'v1/getnotifications';
const URL_RESOLVE_NOTIFICATION = API_URL + 'v1/resolvenotification';

// Timeout for remote calls
const HTTP_TIMEOUT: number = 5000;

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

// A basic http response holding only a success = true/false flag
export interface SuccessResult {
    result: boolean
}

// An object that can be mapped.
export interface MappableObject {
    id: number,
    latitude: number,
    longitude: number,
    distance_m: number,
}

// Parent object that has a photo_link and imageUrl.
// This makes it easy to load the image for various types of things.
export interface BaseImageObject {
    photo_link: string,
    imageUrl: SafeUrl | undefined, // Not pulled via api but will be filled in later as needed
}

// Data for the current user
export interface MyInfo extends MappableObject, BaseImageObject {
    userid: string,
    name: string,
    nickname: string,
    home_address: string,
}

// Data for a neighbor
export interface Neighbor extends MappableObject, BaseImageObject {
    name: string,
    home_address: string,
    depth: number,
    is_friend: boolean,
    friendship_requested: boolean,
    tool_count: number,
}

// Data for a friend request
export interface FriendRequest {
    neighbor_id: number,
    message: string,
    request_ts: Date
}

// Data for a notification
export interface Notification {
    id: number,
    from_neighbor?: number,
    type: string,
    message: string,
    created_ts: Date,
    read: boolean,
}


// Data for a tool
export interface Tool extends MappableObject, BaseImageObject {
    owner_id: number,
    short_name: string,
    brand: string,
    name: string,
    product_url: string,
    replacement_cost: number,
    category_id: number,
    category: string,
    category_icon: string,
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
        private sanitizer: DomSanitizer,
    ) { 
        this.myInfo = signal(this.defaultMyInfo);
        this.myInfoSignal = this.myInfo.asReadonly();
        this.expireMyInfo = signal<boolean>(true, { equal: (a,b) => false }); // When set, we need to discard MyInfo

        // Watch the signal
        effect(() => {
            this.expireMyInfo(); // Link the effect to the proper signal so it functions
            console.log("DataService: wiping mydata");
            this.myInfo.set(this.defaultMyInfo);
        });
    }

    // Caches
    private neighborCache: BoundedMap<number, Neighbor> = new BoundedMap(100);
    private toolCache: BoundedMap<number, Tool> = new BoundedMap(100);
    private photoCache: BoundedMap<string, Blob> = new BoundedMap(100);

    // A blank MyInfo
    private readonly defaultMyInfo: MyInfo = {
        id: -1,
        latitude: 0,
        longitude: 0,
        distance_m: 0,
        photo_link: '',
        imageUrl: undefined,
        userid: '',
        name: '',
        nickname: '',
        home_address: '',
    };

    // Signals for my info.  Use this to get the current logged in guy & his picture.
    private myInfo: WritableSignal<MyInfo>;
    // Public signals
    public readonly myInfoSignal: Signal<MyInfo>;
    public expireMyInfo: WritableSignal<boolean>; // If true, we need to discard MyInfo

    // Get my info
    getMyInfo(): Observable<Signal<MyInfo>> {
        if (this.myInfo().id <= 0) {
            return this.http.post<MyInfo>(
                URL_MY_INFO,
                {},
                {},
            ).pipe(
                tap(myInfo => {
                    // Fire the request to get the picture
                    if (! myInfo.photo_link) {
                        myInfo.photo_link = "default_neighbor.svg";
                    }
                    console.log("Login: Requesting picture for logged in user: " + myInfo.photo_link);
                    this.getPictureAsSafeUrl(myInfo.photo_link).subscribe(value => {
                        if (value) {
                            this.myInfo.update(current => ({... current, imageUrl: value }));
                        }
                    });
                }),
                map(myInfo => {
                    // Take imageUrl out of the stuff to update.
                    // That is updated above in the other query.
                    // Without this, out of order operations can end up with a blank picture.
                    const { imageUrl, ...newstuff } = myInfo;
                    this.myInfo.update(current => {
                        const { imageUrl, ...trash } = current;
                        return { imageUrl, ...newstuff };
                    });
                    return this.myInfoSignal;
                })
            );
        } else {
            // Data already loaded, don't re-query
            return of(this.myInfoSignal);
        }
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
    expirefriends(): Observable<string> {
        return this.http.post<string>(
            URL_EXPIRE_FRIENDS,
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
    // If you do return a cached version, update all the properties to the new values.
    // If it's a new neighbor, cache it.
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

    // Get a single neighbor.
    // If it's already cached, return that instead.
    // If it's new, put in the neighbor cache and request the image async.
    getNeighbor(id: number): Observable<Neighbor> {
        // Id <= 0 indicates a non-neighbor (e.g. the "Me" marker)
        if (id <= 0) {
            return EMPTY;
        }
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
            .pipe(
                // Cache the neighbor object
                tap(neighbor => this.neighborCache.set(neighbor.id, neighbor)),
                // Request that the image loads
                tap(neighbor => {
                    if (neighbor.photo_link) {
                        this.loadImageUrl(neighbor, "default_neighbor.svg").subscribe();
                    }
                })
            )
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

    // Get a picture as a SafeURL
    getPictureAsSafeUrl(photo_id: string): Observable<SafeUrl> {
        return this.getPicture(photo_id)
            .pipe(map(blob => {
                const objectURL = URL.createObjectURL(blob);
                return this.sanitizer.bypassSecurityTrustUrl(objectURL);
            }));
    }

    // Create a friendship request from me to another person.
    requestFriendship(neighborId: number, message: string): Observable<void> {
        const body = {
            neighborId: neighborId,
            message: message,
        };
        return this.http.post<void>(
            URL_REQ_FRIENDSHIP,
            body,
            {},
        );
    }

    // Create a friendship (accept a request) to me from another person.
    createFriendship(neighborId: number): Observable<void> {
        const body = {
            neighborId: neighborId,
        };
        return this.http.post<void>(
            URL_CREATE_FRIENDSHIP,
            body,
            {},
        );
    }

    // Cancel a friendship request
    cancelFriendshipRequest(neighborId: number): Observable<void> {
        const body = {
            neighborId: neighborId,
        };
        return this.http.post<void>(
            URL_CANCEL_FRIENDSHIP_REQ,
            body,
            {},
        );
    }

    // Remove a friendship from me to another person.
    // You need to call expirefriends() after this.
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

    // Get all notifications
    getNotifications(): Observable<Notification[]> {
        return this.http.post<Notification[]>(
            URL_GET_NOTIFICATIONS,
            {},
            httpOptions,
        ).pipe(
            map(notifications => notifications.map(n => ({
                ...n,
                created_ts: new Date(n.created_ts)
            })))
        )
    }

    // Resolve a notification
    resolveNotification(id: number): Observable<void> {
        const body = {
            id: id
        };
        return this.http.post<void>(
            URL_RESOLVE_NOTIFICATION,
            body,
            httpOptions,
        )
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

    // Update or create a tool
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

