import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, EMPTY, iif, map, Observable, of, tap } from 'rxjs';
import { effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { BoundedMap } from './boundedmap';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment'

// URLs
const API_URL = environment.baseUrl;
const URL_USERID_AVAILABLE = API_URL + 'v1/auth/useridavailable';
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
const URL_GET_TOOL_CATEGORY = API_URL + 'v1/toolcategory';
const URL_GET_TOOL_KEYWORDS = API_URL + 'v1/toolkeywords';
const URL_GET_TOOL = API_URL + 'v1/gettool';
const URL_GET_PICTURE = API_URL + 'v1/getImage';
const URL_GET_TOOL_CATEGORIES = API_URL + 'v1/gettoolcategories';
const URL_UPDATE_TOOL = API_URL + 'v1/updatetool';
const URL_CREATE_TOOL = API_URL + 'v1/createtool';
const URL_BORROW_TOOL = API_URL + 'v1/requestborrow';
const URL_CANCEL_BORROW_TOOL = API_URL + 'v1/deleteborrowrequest';
const URL_ACCEPT_BORROW_TOOL = API_URL + 'v1/acceptborrow';
const URL_REJECT_BORROW_TOOL = API_URL + 'v1/rejectborrow';
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

// An object that is ultimately sourced from the database
export interface DbSourceObject {
    loaded: boolean, // Has this been loaded from the database
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
    imageLoaded: boolean, // Has the image been loaded from the database
}

// Data for the current user
export interface MyInfo extends DbSourceObject, MappableObject, BaseImageObject {
    userid: string,
    name: string,
    nickname: string,
    home_address: string,
    phone_number: string,
    email: string,
}

// Data for a neighbor
export interface Neighbor extends DbSourceObject, MappableObject, BaseImageObject {
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
    data: any,
    created_ts: Date,
    read: boolean,
}

export enum ToolStatus {
    Unknown = "unknown",            // default value
        // Statuses for tools that I own
    Owned = "owned",                // I own the tool and it's not lent out right now
    Held = "held",                  // I own the tool but nobody can borrow it (e.g. I'm using it)
    Lent = "lent",                  // I own the tool and it's lent out
        // Statuses for tools that others own
    Available = "available",        // Available for me to borrow
    Unavailable = "unavailable",    // Not available for me to borrow (e.g. held or lent to someone else)
    Requested = "requested",        // I asked to borrow this but the owner hasn't answered yet
                                    // or it's mine and someone has requested it
}

// Data for a tool
export interface Tool extends DbSourceObject, MappableObject, BaseImageObject {
    owner_id: number,
    short_name: string,
    brand: string,
    name: string,
    product_url: string,
    replacement_cost: number,
    category_id: number,
    category: string,
    category_icon: string,
    ownerName: string | undefined,
    ownerimageUrl: SafeUrl | undefined,
    ownerLoaded: boolean,
    ownerImageLoaded: boolean,
    status: ToolStatus,
    search_terms: string[],
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
            // console.log("DataService: wiping mydata");
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
        loaded: false,
        imageLoaded: false,
        phone_number: '',
        email: ''
    };

    // Signals for my info.  Use this to get the current logged in guy & his picture.
    private myInfo: WritableSignal<MyInfo>;
    // Public signals
    public readonly myInfoSignal: Signal<MyInfo>;
    public expireMyInfo: WritableSignal<boolean>; // If true, we need to discard MyInfo

    // Check if a given userid is available
    useridIsAvailable(userid: string): Observable<boolean> {
        const body = {
            userid: userid
        };
        return this.http.post<SuccessResult>(
            URL_USERID_AVAILABLE,
            body,
            {},
        ).pipe(
            map((sr: SuccessResult) => sr.result)
        );
    }

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
                    // console.log("Login: Requesting picture for logged in user: " + myInfo.photo_link);
                    this.getPictureAsSafeUrl(myInfo.photo_link).subscribe(value => {
                        if (value) {
                            this.myInfo.update(current => ({... current, imageUrl: value, imageLoaded: true }));
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
                        return { imageUrl, ...newstuff, loaded: true };
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
        return this._getNeighbors(URL_FRIENDS, body);
    }

    // List all neighbors within some radius of me
    listNeighbors(radiusMiles: number = 100): Observable<Neighbor[]> {
        const body = {
            radius_miles: radiusMiles
        };
        return this._getNeighbors(URL_ALL_NEIGHBORS, body);
    }

    // Get my set of neighbors.
    // If the neighbor is already in the cache, return that object but updated.
    // Otherwise add it to the cache.
    private _getNeighbors(url: string, body: any = {}): Observable<Neighbor[]> {
        return this.http.post<Neighbor[]>(
            url,
            body,
            {},
        )
        .pipe(
            // Handle cached versions
            map((neighbors: Neighbor[]) => neighbors.map(neighbor => {
                const cachedNeighbor = this.getOrCreateNeighbor(neighbor.id);
                Object.assign(cachedNeighbor, neighbor); // Update attributes from db
                cachedNeighbor.loaded = true;
                cachedNeighbor.imageLoaded = false;
                return cachedNeighbor;
            }))
        );
    }

    // Create a new neighbor object.
    // Nowhere else should ever create a Neighbor object.
    // If this neighbor id is already in the cache, return that object (untouched).
    // If not, put the new neighbor into the cache and return it.
    // This does not make db calls.
    getOrCreateNeighbor(id: number): Neighbor {
        if (this.neighborCache.has(id)) {
            return this.neighborCache.getWithoutReinsert(id)!;
        } else {
            const neighbor: Neighbor = {
                id: id,
                name: "",
                photo_link: "",
                latitude: 0,
                longitude: 0,
                home_address: "",
                distance_m: 0,
                is_friend: false,
                friendship_requested: false,
                imageUrl: undefined,
                depth: 0,
                tool_count: 0,
                loaded: false,
                imageLoaded: false,
            };
            this.neighborCache.set(id, neighbor);
            return neighbor;
        }
    }

    // Get a single neighbor.  If not loaded, load it immediately.
    // This is what display components should call.
    // This automatically requests that the image of the neighbor is loaded.
    // If imageLoadedFunction is supplied, that's called after the image is loaded.
    getNeighbor(id: number, imageLoadedFunction?: (imageUrl: SafeUrl) => void): Observable<Neighbor> {
        // Id <= 0 indicates a non-neighbor (e.g. the "Me" marker)
        if (id <= 0) {
            return EMPTY;
        }

        // Get the cached neighbor
        const cachedNeighbor = this.getOrCreateNeighbor(id);

        // If data isn't loaded, call the database
        if (!cachedNeighbor.loaded) {
            // console.log("getNeighbor: Neighbor from db: " + id);
            return this.http.post<Neighbor>(
                URL_GET_NEIGHBOR,
                { neighborId: id },
                {},
            )
            .pipe(
                // Do not return the new object, copy everything into the cached copy
                map(dbNeighbor => {
                    Object.assign(cachedNeighbor, dbNeighbor); // Update attributes from db
                    cachedNeighbor.loaded = true;
                    // console.log("getNeighbor: Image from db: " + cachedNeighbor.id);
                    this.loadImageUrl(cachedNeighbor, "default_neighbor.svg").subscribe({
                        error: (err) => {
                            console.error('Error loading image in getNeighbor:', err);
                            console.log('Error: ' + cachedNeighbor.photo_link);
                        },
                        complete: () => {
                            cachedNeighbor.imageLoaded = true;
                            // Tell the caller that the image is loaded
                            if (imageLoadedFunction && cachedNeighbor.imageUrl) {
                                imageLoadedFunction(cachedNeighbor.imageUrl);
                            }
                        }
                    });
                    return cachedNeighbor;
                })
            );
        } else {
            // console.log("getNeighbor: Neighbor from cache: " + id);
            // If data is loaded, make sure the photo is loaded
            if (cachedNeighbor.imageLoaded) {
                // Image already loaded, tell the caller
                if (imageLoadedFunction) {
                    imageLoadedFunction(cachedNeighbor.imageUrl!);
                }
            } else {
                // Image not loaded, load it and then tell the caller
                // console.log("getNeighbor: Image from db: " + cachedNeighbor.id);
                this.loadImageUrl(cachedNeighbor, "default_neighbor.svg").subscribe({
                    error: (err) => {
                        console.error('Error loading image in getNeighbor:', err);
                        console.log('Error: ' + cachedNeighbor.photo_link);
                    },
                    complete: () => {
                        cachedNeighbor.imageLoaded = true;
                        // Tell the caller that the image is loaded
                        if (imageLoadedFunction && cachedNeighbor.imageUrl) {
                            imageLoadedFunction(cachedNeighbor.imageUrl);
                        }
                    }
                })
            }
            return of(cachedNeighbor);
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
                created_ts: new Date(n.created_ts),
                data: n.data ? JSON.parse(n.data) : undefined,
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
        return this._getTools(URL_MY_TOOLS);
    }

    // List all tools within some radius of me
    listTools(radiusMiles: number = 100): Observable<Tool[]> {
        return this._getTools(URL_ALL_TOOLS, { radius_miles: radiusMiles });
    }

    // Get a set of tools.
    // If the tool is already in the cache, return that object but updated.
    // Otherwise add it to the cache.
    private _getTools(url: string, body: any = {}): Observable<Tool[]> {
        return this.http.post<Tool[]>(
            url,
            body,
            {},
        )
        .pipe(
            // Handle cached versions
            map((tools: Tool[]) => tools.map(tool => {
                const cachedTool = this.getOrCreateTool(tool.id);
                Object.assign(cachedTool, tool); // Update attributes from db
                cachedTool.loaded = true;
                cachedTool.imageLoaded = false;
                return cachedTool;
            }))
        );
    }

    // Create a new tool object.
    // Nowhere else should ever create a Tool object.
    // If this tool id is already in the cache, return that object (untouched).
    // If not, put the new tool into the cache and return it.
    // This does not make db calls.
    getOrCreateTool(id: number): Tool {
        if (this.toolCache.has(id)) {
            return this.toolCache.getWithoutReinsert(id)!;
        } else {
            const tool: Tool = {
                id: id,
                owner_id: 0,
                short_name: "",
                brand: "",
                name: "",
                product_url: "",
                replacement_cost: 0,
                category_id: 0,
                category: "",
                category_icon: "",
                latitude: 0,
                longitude: 0,
                distance_m: 0,
                photo_link: "",
                imageUrl: undefined,
                ownerName: undefined,
                ownerimageUrl: undefined,
                loaded: false,
                imageLoaded: false,
                ownerLoaded: false,
                ownerImageLoaded: false,
                status: ToolStatus.Unknown,
                search_terms: [],
            };
            this.toolCache.set(id, tool);
            return tool;
        }
    }

    // Get the suggested category for a tool.
    getSuggestedCategory(description: string): Observable<ToolCategory | undefined> {
        return this.http.post<ToolCategory>(
            URL_GET_TOOL_CATEGORY,
                { tooldescription: description },
                {}
            )
        .pipe(
            catchError(err => {
                console.log("Can't guess tool category: " + JSON.stringify(err));
                return of(undefined)
            })
        )
    }

    // Get the suggested keywords for a tool.
    getSuggestedKeywords(description: string): Observable<string[] | undefined> {
        return this.http.post<string[]>(
            URL_GET_TOOL_KEYWORDS,
                { tooldescription: description },
                {}
            )
        .pipe(
            catchError(err => {
                console.log("Can't guess tool keywords: " + err);
                return of(undefined)
            })
        )
    }

    // Get a single tool.  If not loaded, load it immediately.
    // If loadOwner = true, the owner Neighbor will be loaded. If you don't need it, set to false.
    // This is what display components should call.
    // This automatically requests that the image of the tool is loaded.
    // If imageLoadedFunction is supplied, that's called after the image is loaded.
    getTool(id: number, loadOwner: boolean, imageLoadedFunction?: (imageUrl: SafeUrl) => void): Observable<Tool> {
        // Id <= 0 indicates a non-tool (e.g. the "Me" marker)
        if (!id || id <= 0) {
            return EMPTY;
        }

        // Get the cached neighbor
        const cachedTool = this.getOrCreateTool(id);

        // If data isn't loaded, call the database
        if (!cachedTool.loaded) {
            // console.log("getTool: Tool from db: " + id);
            return this.http.post<Tool>(
                URL_GET_TOOL,
                { id: cachedTool.id },
                {}
            )
            .pipe(
                // Do not return the new object, copy everything into the cached copy
                map(dbTool => {
                    Object.assign(cachedTool, dbTool); // Update attributes from db
                    cachedTool.loaded = true;

                    this._updateToolDeep(cachedTool, loadOwner, imageLoadedFunction);

                    return cachedTool;
                })
            );
        } else {
            // console.log("getTool: Tool from cache: " + id);
            // Make sure all the deep updates are done
            this._updateToolDeep(cachedTool, loadOwner, imageLoadedFunction);
            
            return of(cachedTool);
        }
    }

    // Update the image, neighbor, and neighbor image for a tool.
    // This makes whatever DB calls are needed.
    private _updateToolDeep(cachedTool: Tool, loadOwner: boolean, imageLoadedFunction?: (imageUrl: SafeUrl) => void): void {
        // Update the image if needed
        if (!cachedTool.imageLoaded) {
            // console.log("getTool: Image from db: " + cachedTool.id);
            this.loadImageUrl(cachedTool, "default_tool.svg").subscribe({
                error: (err) => {
                    console.error('Error loading image in getTool:', err);
                    console.log('Error: ' + cachedTool.photo_link);
                },
                complete: () => {
                    cachedTool.imageLoaded = true;
                    // Tell the caller that the image is loaded
                    if (imageLoadedFunction) {
                        imageLoadedFunction(cachedTool.imageUrl!);
                    }
                }
            });
        } else {
            if (imageLoadedFunction) {
                imageLoadedFunction(cachedTool.imageUrl!);
            }
        }

        // Update the neighbor + image if needed
        if (!cachedTool.ownerLoaded && loadOwner) {
            this.getNeighbor(cachedTool.owner_id, imageUrl => { cachedTool.ownerimageUrl = imageUrl; cachedTool.ownerImageLoaded = true }).subscribe(neighbor => {
                cachedTool.ownerName = neighbor.name;
                cachedTool.ownerLoaded = true;
            });
        }
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

    // Request to borrow a tool
    borrowTool(id: number, message: string): Observable<void> {
        const body = {
            toolId: id,
            message: message,
        };

        return this.http.post<void>(
            URL_BORROW_TOOL,
            body,
            {}
        );
    }

    // Delete existing borrow request
    cancelBorrowRequest(id: number) {
        const body = {
            toolId: id,
        };

        return this.http.post<void>(
            URL_CANCEL_BORROW_TOOL,
            body,
            {}
        );
    }

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

    // Accept a borrow request
    acceptBorrowRequest(neighborId: number, toolId: number, notificationId: number, message: string) : Observable<void> {
        const body = {
            toolId: toolId,
            notificationId: notificationId,
            message: message
        };

        return this.http.post<void>(
            URL_ACCEPT_BORROW_TOOL,
            body,
            {}
        );
    }

    // Accept a borrow request
    rejectBorrowRequest(neighborId: number, toolId: number, notificationId: number, message: string) : Observable<void> {
        const body = {
            toolId: toolId,
            notificationId: notificationId,
            message: message
        };

        return this.http.post<void>(
            URL_ACCEPT_BORROW_TOOL,
            body,
            {}
        );
    }
}

