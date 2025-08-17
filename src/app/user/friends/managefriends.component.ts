import { Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef, NgZone } from "@angular/core";
import { DataService, Neighbor } from "../../services/data.service";
import { Content, Layer, LeafletMouseEvent } from "leaflet";
import { MapComponent, MarkerData } from "../../map/map.component";
import { SortedArray } from "../../services/sortedarray";
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MatCard, MatCardModule } from "@angular/material/card";
import { QueryParamsHandling, RouterModule } from "@angular/router";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { CardComponent } from "../../card/card.component";

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
        CardComponent,
    ],
    templateUrl: './managefriends.component.html',
    styleUrl: './managefriends.component.scss',
})
// A component that uses the map to show all of your direct linked friends.
export class ManageFriendsComponent implements OnInit, AfterViewInit {
    @ViewChild('mapRef') map!: MapComponent;
    @ViewChildren('neighborCards', { read: ElementRef }) cards!: QueryList<ElementRef>;

    constructor(
        private dataService: DataService,
        private sanitizer: DomSanitizer,
        private dialog: MatDialog,
        private zone: NgZone,
    ) {}

    ngAfterViewInit(): void {
        this.cards.changes.subscribe(queryList => {
            queryList.forEach((cardRef: ElementRef, index: number) => {
                console.log(`ElementRef for mat-card at index ${index}:`, cardRef.nativeElement);
                // You can now interact with the nativeElement of each mat-card
            });
        });
    }

    // Stuff for the map
    private readonly layerGroupNameFriends: string = "Friends";
    private readonly layerGroupNameNonFriends: string = "Others";
    layerGroupNames: string[] = [ this.layerGroupNameFriends, this.layerGroupNameNonFriends ];
    markerData: MarkerData[] | undefined;

    // List of all visible friends & neighbors on the map
    private visibleNeighbors: globalThis.Map<string, SortedArray<Neighbor>> = new globalThis.Map();
    allVisibleNeighbors: SortedArray<Neighbor> = new SortedArray<Neighbor>(this.sortFunction);
    
    ngOnInit(): void {
        this.getFriendsAndNeighbors();
    }
    
    // Get a list of all my friends
    private getFriendsAndNeighbors(): void {
        Promise.all([
            this.dataService.getFriends(),
            this.dataService.listNeighbors(),    
        ])
        .then(([friends, neighbors]) => {
            let markerArray: MarkerData[] = [];

            // Process friends
            console.log("Retrieved friends: " + friends.length);
            friends.forEach(friend => {
                let markerData: MarkerDataWithDistance = {
                    layerGroupName: this.layerGroupNameFriends,
                    id: friend.id,
                    latitude: friend.latitude,
                    longitude: friend.longitude,
                    icon: "fa-solid fa-user-tie",
                    color: "green",
                    popupText: "<div>Neighbor: " + friend.name + "</div>",
                    onclick: (id: number) => { // Make sure to run this in the angular zone
                        this.zone.run(() => {
                            this.neighborOnClick(id);
                        })
                    },
                    distance_m: friend.distance_m,
                }
                markerArray.push(markerData);
            });

            // Process neighbors
            console.log("Retrieved neighbors: " + neighbors.length);
            neighbors.forEach(neighbor => {
                let markerData: MarkerDataWithDistance = {
                    layerGroupName: this.layerGroupNameNonFriends,
                    id: neighbor.id,
                    latitude: neighbor.latitude,
                    longitude: neighbor.longitude,
                    icon: "fa-solid fa-user-tie",
                    color: "blue",
                    popupText: "<div>Neighbor: " + neighbor.name + "</div>",
                    onclick: (id: number) => { // Make sure to run this in the angular zone
                        this.zone.run(() => {
                            this.neighborOnClick(id);
                        })
                    },
                    distance_m: neighbor.distance_m,
                }
                // Don't add neighbors if they're already friends
                if (! markerArray.some(obj => obj.id === neighbor.id)) {
                    markerArray.push(markerData);
                }
            });

            this.markerData = markerArray.sort(this.sortFunction);
        });
    }

    // Provided to map to sort visible marker lists
    public sortFunction(a:any, b:any) {
        return a.distance_m - b.distance_m
    };

    // Called by the map when the neighbor is clicked on
    public neighborOnClick(id: number): void {
        console.log("Clicked on neighbor: " + id);

        const index = this.allVisibleNeighbors.findIndex(item => item.id === id);
        const targetCard = this.cards.get(index);
        if (targetCard) {
            targetCard.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Add blinking class
            targetCard.nativeElement.classList.add('blink-border');

            // Remove it after animation completes
            setTimeout(() => {
                targetCard.nativeElement.classList.remove('blink-border');
            }, 1000); // match animation duration
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

        this.dataService.getNeighbor(id).then(
            (n: Neighbor) => {
                    
                Object.assign(neighbor, n);
                if (! n.imageUrl) {
                    // Request the image
                    if(! n.photo_link) {
                        n.photo_link = "default.svg";
                    }
                    this.dataService.getPicture(n.photo_link).then(
                        (blob: Blob) => {
                            const objectURL = URL.createObjectURL(blob);
                            neighbor.imageUrl = this.sanitizer.bypassSecurityTrustUrl(objectURL);
                        }
                    );
                }
            }
        );

        return neighbor;
    }

    // Called by the map when it's embedded leaflet map is ready
    public onReady(saMap: Map<string, SortedArray<any>>) {
        console.log("Ready!");
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
        console.log("Clicked on list index: " + index);

        const neighbor: Neighbor | undefined = this.allVisibleNeighbors.get(index);

        if (neighbor) {
            // Center and zoom the map on the clicked item
            this.map.setMapView([ neighbor.latitude, neighbor.longitude ], 18);

            const dialogConfig = new MatDialogConfig();
            dialogConfig.autoFocus = true;
            dialogConfig.data = neighbor;

            this.dialog.open(CardComponent, dialogConfig);
        }
    }

    // Keep the list of all items in sync with the layer groups.
    // TODO: This feels janky...
    // Instead of clear() and rebuild, try to add/remove only when necessary.
    private refreshAllVisibleNeighbors(): void {
        // Make sure everything in the layer groups are in the all list
        this.layerGroupNames.forEach(layerGroupName => {
            this.visibleNeighbors.get(layerGroupName)?.forEach(neighbor => {
                if (! this.allVisibleNeighbors.contains(neighbor, obj => obj.id === neighbor.id)) {
                    this.allVisibleNeighbors.add(neighbor);
                }
            });
        });

        // Make sure everything in the all list is in one of the layer groups
        for (let i = this.allVisibleNeighbors.size() - 1; i >= 0; i--) { // Iterate backwards to safely remove stuff
            let neighbor: Neighbor | undefined = this.allVisibleNeighbors.get(i);
            if (neighbor) {
                let exists: boolean = this.layerGroupNames.some(
                    layerGroupName => {
                        return this.visibleNeighbors.get(layerGroupName)?.contains(neighbor, obj => obj.id === neighbor.id);
                    }
                );
            
                if(! exists) {
                    this.allVisibleNeighbors.remove(i);
                }
            }
        }
    }
}
