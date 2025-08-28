import { Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef, ChangeDetectorRef, signal, Signal, inject, Injector, effect, WritableSignal } from "@angular/core";
import { DataService, Neighbor } from "../../services/data.service";
import { latLng, LatLng } from "leaflet";
import { MapComponent, MarkerData } from "../../map/map.component";
import { SortedArray } from "../../services/sortedarray";
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { FriendCardComponent } from "../../friend-card/friend-card.component";
import { forkJoin, map, Observable } from "rxjs";

// Extend the leaflet Marker to include a distance (in meters) from me.
interface MarkerDataWithDistance extends MarkerData {
    distance_m: number,
}

@Component({
    standalone: true,
    selector: 'app-manage-friends',
    imports: [
        RouterModule,
        MapComponent,
        MatCardModule,
        MatDialogModule,
    ],
    templateUrl: './managefriends.component.html',
    styleUrl: './managefriends.component.scss',
})
// A component that uses the map to show all of your direct linked friends.
export class ManageFriendsComponent implements OnInit, AfterViewInit {
    // The main MapComponent
    @ViewChild('mapRef') map!: MapComponent;
    // The list of neighbors (fed by the map)
    @ViewChildren('neighborCards', { read: ElementRef }) cards!: QueryList<ElementRef>;

    constructor(
        private dataService: DataService,
        private dialog: MatDialog,
        private changeDetectorRef: ChangeDetectorRef,
    ) {}

    ngAfterViewInit(): void {
    }

    // Animation stuff
    neighborCountBounceFlag: WritableSignal<boolean> = signal(false); // Set to true momentarily when the visible neighbor count changes 

    // Stuff for the map
    defaultCenterLocation!: LatLng;
    defaultZoomLevel: number = 15;
    private readonly layerGroupNameMe: string = "Me"; // Layer holding me @ the center point
    private readonly layerGroupNameFriends: string = "Friends"; // My friends (and friends-of-friends)
    private readonly layerGroupNameNonFriends: string = "Others"; // Other neighbors
    readonly layerGroupNames: string[] = [ this.layerGroupNameMe, this.layerGroupNameFriends, this.layerGroupNameNonFriends ];
    markerData: MarkerData[] | undefined; // All of the markers to draw on the map

    // List of all visible friends & neighbors on the map
    private visibleNeighbors: globalThis.Map<string, SortedArray<Neighbor>> = new globalThis.Map(); // Map of layer name (e.g. Friends) -> neighbor array
    allVisibleNeighbors: SortedArray<Neighbor> = new SortedArray<Neighbor>(this.sortFunction); // Combined list of all visible neighbors (for display)
    
    // Setup for the neighborCountBounceFlag
    private injector = inject(Injector);
    allVisibleNeighborsCount: Signal<number> = this.allVisibleNeighbors.sizeSignal;
    
    ngOnInit(): void {
        // Setup for the neighborCountBounceFlag.
        // This effect will momentarily set the bounce flag to true when the visible neighbor count changes.
        effect(() => {
            this.allVisibleNeighborsCount(); // Link the effect to the proper signal so it functions
            this.neighborCountBounceFlag.set(true);
            setTimeout(() => this.neighborCountBounceFlag.set(false), 400);

        }, {injector: this.injector});

        // Get all the data!
        this.getAllData().subscribe((markerData: MarkerData[]) => {
            this.markerData = markerData;
        });
    }
    
    // Get all data into this.markerData
    private getAllData(): Observable<MarkerData[]> {
        return forkJoin([
            this.dataService.getMyInfo(),
            this.dataService.getFriends(),
            this.dataService.listNeighbors(),    
        ])
        .pipe(
            map(([myinfo, friends, neighbors]) => {
                let markerArray: MarkerData[] = [];

                // Process Me
                {
                    let markerData: MarkerDataWithDistance = {
                        layerGroupName: this.layerGroupNameMe,
                        id: 0,
                        latitude: myinfo.latitude,
                        longitude: myinfo.longitude,
                        icon: 'fa-solid fa-face-grin-wide',
                        color: "orange",
                        distance_m: 0,
                        popupText: "", // No popup
                        onclick: function (id: number): void {}, // Do nothing on click
                    }
                    markerArray.push(markerData);
                }
                // While we're here, set the center point on the map to my location
                this.defaultCenterLocation = latLng([ myinfo.latitude, myinfo.longitude ]);
                
                // Process friends
                // console.log("Retrieved friends: " + friends.length);
                friends.forEach(friend => {
                    let markerData: MarkerDataWithDistance = {
                        layerGroupName: this.layerGroupNameFriends,
                        id: friend.id,
                        latitude: friend.latitude,
                        longitude: friend.longitude,
                        icon: "fa-solid fa-user-tie",
                        color: friend.depth == 1 ? "green-dark" : "green-light",
                        popupText: "<div>Neighbor: " + friend.name + "</div>",
                        onclick: this.neighborOnClick.bind(this), // Careful with the this reference
                        distance_m: friend.distance_m,
                    }
                    markerArray.push(markerData);
                });

                // Process neighbors
                // console.log("Retrieved neighbors: " + neighbors.length);
                neighbors.forEach(neighbor => {
                    let markerData: MarkerDataWithDistance = {
                        layerGroupName: this.layerGroupNameNonFriends,
                        id: neighbor.id,
                        latitude: neighbor.latitude,
                        longitude: neighbor.longitude,
                        icon: "fa-solid fa-user-tie",
                        color: "blue",
                        popupText: "<div>Neighbor: " + neighbor.name + "</div>",
                        onclick: this.neighborOnClick.bind(this), // Careful with the this reference
                        distance_m: neighbor.distance_m,
                    }
                    // Don't add neighbors if they're already friends
                    if (! markerArray.some(obj => obj.id === neighbor.id)) {
                        markerArray.push(markerData);
                    }
                });

                return markerArray.sort(this.sortFunction);
            })
        );
    }

    // Provided to map to sort visible marker lists
    public sortFunction(a:any, b:any) {
        return a.distance_m - b.distance_m
    };

    // Called by the map when the neighbor is clicked on
    public neighborOnClick(id: number): void {
        const index = this.allVisibleNeighbors.findIndex(item => item.id === id);
        const targetCard = this.cards.get(index);
        if (targetCard) {
            targetCard.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Add blinking class
            targetCard.nativeElement.classList.add('blink-border');

            // Remove it after animation completes
            setTimeout(() => {
                targetCard.nativeElement.classList.remove('blink-border');
            }, 2200); // match animation duration
        }
    }

    // Called by the map whenever an ID is put it in the list of visible markers
    public idToNeighbor(id: number): Neighbor {
        const neighbor: Neighbor = {
            id: id,
            name: "",
            photo_link: "",
            latitude: 0,
            longitude: 0,
            home_address: "",
            distance_m: 0,
            is_friend: false,
            imageUrl: undefined,
            depth: 0
        };

        this.dataService.getNeighbor(id).subscribe(
            (n: Neighbor) => {
                Object.assign(neighbor, n);
                if (! n.imageUrl) {
                    // Request/load the image
                    this.dataService.loadImageUrl(neighbor, "default.svg").subscribe();
                }
            }
        );

        return neighbor;
    }

    // Called by the map when it's embedded leaflet map is ready
    public onReady(saMap: Map<string, SortedArray<any>>) {
        // console.log("Ready!");
        this.layerGroupNames.forEach(layerGroupName => {
            const sa: SortedArray<any> | undefined = saMap.get(layerGroupName);
            if (sa) {
                setTimeout(() => {
                    this.visibleNeighbors.set(layerGroupName, sa);
                    this.refreshAllVisibleNeighbors();
                });
            }
        });
    }

    // Called by the map whenever the visible layers are emptied
    public onVisibleLayersCleared(groupName: string) {
        setTimeout(() => {
            // Resync the allVisibleNeighbors array
            this.refreshAllVisibleNeighbors();
        });
    }

    // Called by the map whenever the visible layers are reloaded
    public onVisibleLayersRefreshed(groupName: string) {
        // Need to resort after loading new data
        setTimeout(() => {
            this.visibleNeighbors.get(groupName)?.resort();
            // Resync the allVisibleNeighbors array
            this.refreshAllVisibleNeighbors();
        });
    }

    // Called by the neighbor list when a neighbor is clicked
    public onListNeighborClick(index: number): void {
        const neighbor: Neighbor | undefined = this.allVisibleNeighbors.get(index);

        if (neighbor) {
            // Center and zoom the map on the clicked item
            this.map.setMapView([ neighbor.latitude, neighbor.longitude ], 18);

            const dialogConfig = new MatDialogConfig();
            dialogConfig.autoFocus = true;
            dialogConfig.data = {
                neighbor: neighbor,
                fnCreateFriendship: this.createFriendship.bind(this),
                fnDeleteFriendship: this.deleteFriendship.bind(this),
            }

            this.dialog.open(FriendCardComponent, dialogConfig);
        }
    }

    // Create a new friendship with the provided friend
    public createFriendship(id: number) {
        // console.log("Creating friendship with: " + id);
        this._modifyFriendship( this.dataService.createFriendship(id) );
    }

    // Remove an existing friendship with the provided friend
    public deleteFriendship(id: number) {
        // console.log("Removing friendship with: " + id);
        this._modifyFriendship( this.dataService.removeFriendship(id) );
    }

    // Create or remove a friendship.
    // This handles all the friend reloading stuff required for either.
    private _modifyFriendship(observable: Observable<void>): void {
        observable.subscribe(() => {
            // Reload friends on the server
            this.dataService.reloadfriends().subscribe(() => {
                // Refresh the map data
                this.getAllData().subscribe((markerData: MarkerData[]) => {
                    this.markerData = markerData;
                    this.map.markerData = this.markerData;
                });
            });
        });
    }

    // Keep the list of all items in sync with the layer groups.
    // Exclude the "me" layer so I don't see myself in the list.
    private refreshAllVisibleNeighbors(): void {
        // Remove "me" from consideration
        const layerGroupNamesSubset = this.layerGroupNames.filter(name => name != this.layerGroupNameMe);

        const newItems: Neighbor[] = [];
        layerGroupNamesSubset.forEach(layerGroupName => {
            this.visibleNeighbors.get(layerGroupName)?.forEach(neighbor => {
                newItems.push(neighbor);
            });
        });
        this.allVisibleNeighbors.reload(newItems);
        this.changeDetectorRef.detectChanges();
    }
}
