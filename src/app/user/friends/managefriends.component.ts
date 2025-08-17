import { Component, OnInit, AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef } from "@angular/core";
import { DataService, Neighbor } from "../../services/data.service";
import { latLng, LatLng } from "leaflet";
import { MapComponent, MarkerData } from "../../map/map.component";
import { SortedArray } from "../../services/sortedarray";
import { DomSanitizer } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { FriendCardComponent, FriendCardDialogData } from "../../friend-card/friend-card.component";

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
    @ViewChild('mapRef') map!: MapComponent;
    @ViewChildren('neighborCards', { read: ElementRef }) cards!: QueryList<ElementRef>;

    constructor(
        private dataService: DataService,
        private sanitizer: DomSanitizer,
        private dialog: MatDialog,
    ) {}

    ngAfterViewInit(): void {
    }

    // Stuff for the map
    defaultCenterLocation!: LatLng;
    defaultZoomLevel: number = 8;
    private readonly layerGroupNameMe: string = "Me";
    private readonly layerGroupNameFriends: string = "Friends";
    private readonly layerGroupNameNonFriends: string = "Others";
    readonly layerGroupNames: string[] = [ this.layerGroupNameMe, this.layerGroupNameFriends, this.layerGroupNameNonFriends ];
    markerData: MarkerData[] | undefined;

    // List of all visible friends & neighbors on the map
    private visibleNeighbors: globalThis.Map<string, SortedArray<Neighbor>> = new globalThis.Map();
    allVisibleNeighbors: SortedArray<Neighbor> = new SortedArray<Neighbor>(this.sortFunction);
    
    ngOnInit(): void {
        this.getAllData();
    }
    
    // Get a list of all my friends
    private getAllData(): void {
        Promise.all([
            this.dataService.getMyInfo(),
            this.dataService.getFriends(),
            this.dataService.listNeighbors(),    
        ])
        .then(([myinfo, friends, neighbors]) => {
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
                    onclick: this.neighborOnClick.bind(this), // Careful with the this reference
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
                    onclick: this.neighborOnClick.bind(this), // Careful with the this reference
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
            dialogConfig.data = {
                neighbor: neighbor,
                fnCreateFriendship: this.createFriendship,
                fnDeleteFriendship: this.deleteFriendship,
            }

            this.dialog.open(FriendCardComponent, dialogConfig);
        }
    }

    public createFriendship(id: number) {
        console.log("Creating friendship with: " + id);
    }

    public deleteFriendship(id: number) {
        console.log("Deleting friendship with: " + id);
    }

    // Keep the list of all items in sync with the layer groups.
    // Exclude the "me" layer so I don't see myself in the list.
    // TODO: This feels janky...
    // Instead of clear() and rebuild, try to add/remove only when necessary.
    private refreshAllVisibleNeighbors(): void {
        // Remove "me" from consideration
        const layerGroupNamesSubset = this.layerGroupNames.filter(name => name != this.layerGroupNameMe);

        // Make sure everything in the layer groups are in the all list
        layerGroupNamesSubset.forEach(layerGroupName => {
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
                let exists: boolean = layerGroupNamesSubset.some(
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
