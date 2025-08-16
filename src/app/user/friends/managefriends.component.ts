import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core";
import { DataService, Neighbor } from "../../services/data.service";
import { Content, Layer, LeafletMouseEvent } from "leaflet";
import { MapComponent, MarkerData } from "../../map/map.component";
import { SortedArray } from "../../services/sortedarray";
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";

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
export class ManageFriendsComponent implements OnInit, AfterViewInit {
    @ViewChild('mapRef') map!: MapComponent;

    constructor(
        private dataService: DataService,
        private sanitizer: DomSanitizer,
    ) {}

    // Stuff for the map
    layerGroupNames: string[] = [ "Friends" ];
    markerData: MarkerData[] | undefined;

    // List of all visible neighbors on the map
    visibleNeighbors!: SortedArray<Neighbor>;
    
    ngOnInit(): void {
        this.getFriends();
    }
    
    ngAfterViewInit(): void {
    }

    // Get a list of all my friends
    private getFriends(): void {
        this.dataService.listNeighbors().then(
            (friends: Neighbor[]) => {
                console.log("Retrieved friends: " + friends.length);

                let friendArray: MarkerData[] = [];
                friends.sort(this.sortFunction).forEach(friend => {
                    let friendMarkerData: MarkerData = {
                        layerGroupName: "Friends",
                        id: friend.id,
                        latitude: friend.latitude,
                        longitude: friend.longitude,
                        icon: "fa-solid fa-user-tie",
                        color: "green",
                        popupText: "<div>Neighbor: " + friend.name + "</div>",
                        onclick: this.neighborOnClick
                    }
                    friendArray.push(friendMarkerData);
                });
                this.markerData = friendArray.sort(this.sortFunction);
            }
        )
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
        const sa: SortedArray<any> | undefined = saMap.get("Friends");
        if (sa) {
            setTimeout(() => {
                this.visibleNeighbors = sa;
                console.log("Visible neighbors assigned");
            });
        }
    }

    // Called by the map whenever the visible layers are emptied
    public onVisibleLayersCleared(groupName: string) {
        console.log("Visible neighbors cleared: " + groupName);
    }

    // Called by the map whenever the visible layers are reloaded
    public onVisibleLayersRefreshed(groupName: string) {
        console.log("Visible neighbors refreshed: " + groupName);
        setTimeout(() => {
            this.visibleNeighbors.resort(); // Need to resort after loading the neighbor's data
        });
    }

}
