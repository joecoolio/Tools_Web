import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core";
import { DataService, Neighbor } from "../../services/data.service";
import { Content, Layer, LeafletMouseEvent } from "leaflet";
import { MapComponent, MarkerData } from "../../map/map.component";
import { SortedArray } from "../../services/sortedarray";
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";

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
    ],
    templateUrl: './managefriends.component.html',
    styleUrl: './managefriends.component.scss',
})
// A component that uses the map to show all of your direct linked friends.
export class ManageFriendsComponent implements OnInit {
    @ViewChild('mapRef') map!: MapComponent;

    constructor(
        private dataService: DataService,
        private sanitizer: DomSanitizer,
    ) {}

    // Stuff for the map
    layerGroupNames: string[] = [ "Friends", "Neighbors" ];
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
                    layerGroupName: "Friends",
                    id: friend.id,
                    latitude: friend.latitude,
                    longitude: friend.longitude,
                    icon: "fa-solid fa-user-tie",
                    color: "green",
                    popupText: "<div>Neighbor: " + friend.name + "</div>",
                    onclick: this.neighborOnClick,
                    distance_m: friend.distance_m,
                }
                markerArray.push(markerData);
            });

            // Process neighbors
            console.log("Retrieved neighbors: " + neighbors.length);
            neighbors.forEach(neighbor => {
                let markerData: MarkerDataWithDistance = {
                    layerGroupName: "Neighbors",
                    id: neighbor.id,
                    latitude: neighbor.latitude,
                    longitude: neighbor.longitude,
                    icon: "fa-solid fa-user-tie",
                    color: "blue",
                    popupText: "<div>Neighbor: " + neighbor.name + "</div>",
                    onclick: this.neighborOnClick,
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
            imageUrl: undefined
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
        console.log("Visible neighbors cleared: " + groupName);
        setTimeout(() => {
            // Resync the allVisibleNeighbors array
            this.refreshAllVisibleNeighbors();
        });
    }

    // Called by the map whenever the visible layers are reloaded
    public onVisibleLayersRefreshed(groupName: string) {
        console.log("Visible neighbors refreshed: " + groupName);
        // Need to resort after loading new data
        setTimeout(() => {
            this.visibleNeighbors.get(groupName)?.resort();
            // Resync the allVisibleNeighbors array
            this.refreshAllVisibleNeighbors();
        });
    }

    // Called by the neighbor list when a neighbor is clicked
    public onListNeighborClick(id: number): void {
        console.log("Clicked on list: " + id);
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
        console.log("Size: " + this.allVisibleNeighbors.size());
        for (let i = this.allVisibleNeighbors.size() - 1; i >= 0; i--) { // Iterate backwards to safely remove stuff
            let neighbor: Neighbor | undefined = this.allVisibleNeighbors.get(i);
            if (neighbor) {
                let exists: boolean = this.layerGroupNames.some(
                    layerGroupName => {
                        return this.visibleNeighbors.get(layerGroupName)?.contains(neighbor, obj => obj.id === neighbor.id);
                    }
                );
                console.log("Neighbor : " + neighbor.id + " exists: " + exists);
            
                if(! exists) {
                    this.allVisibleNeighbors.remove(i);
                }
            }
        }
    }
}
