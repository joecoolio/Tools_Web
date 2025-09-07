import { Component, ChangeDetectorRef } from "@angular/core";
import { DataService, MappableObject, Neighbor } from "../../services/data.service";
import { MapComponent, MarkerData } from "../../map/map.component";
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { FriendCardComponent, FriendCardDialogData } from "../../friend-card/friend-card.component";
import { forkJoin, map, Observable } from "rxjs";
import { BrowseObjectsComponent, MarkerDataWithDistance } from "../../shared/browseobjects.component";
import { ResizeDirective } from "../../shared/resize-directive";
import { MessageService } from "../../services/message.service";

@Component({
    standalone: true,
    selector: 'app-manage-friends',
    imports: [
        RouterModule,
        MapComponent,
        MatCardModule,
        MatDialogModule,
        ResizeDirective,
    ],
    templateUrl: './managefriends.component.html',
    styleUrl: './managefriends.component.scss',
})
// A component that uses the map to show all of your direct linked friends.
export class ManageFriendsComponent extends BrowseObjectsComponent {
    constructor(
        protected override dataService: DataService,
        protected override dialog: MatDialog,
        protected override changeDetectorRef: ChangeDetectorRef,
        private messageService: MessageService,
    ) {
        super(dataService, dialog, changeDetectorRef);
    }
    // Stuff for the map
    private readonly layerGroupNameFriends: string = "Friends"; // My friends (and friends-of-friends)
    private readonly layerGroupNameNonFriends: string = "Others"; // Other neighbors
    readonly layerGroupNames: string[] = [ this.layerGroupNameFriends, this.layerGroupNameNonFriends ];
    
    // All the neighbors - in sync with what's provided in this.markerData.
    private neighbors: Neighbor[] = [];

    // Get all data into this.markerData.
    // Also put all the neighbor objects in this.neighbors.
    protected getAllData(): Observable<MarkerData[]> {
        return forkJoin([
            this.dataService.getFriends(),
            this.dataService.listNeighbors(),    
        ])
        .pipe(
            map(([friends, neighbors]) => {
                let markerArray: MarkerData[] = [];

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
                        onclick: this.objectOnClick.bind(this), // Careful with the this reference
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
                        onclick: this.objectOnClick.bind(this), // Careful with the this reference
                        distance_m: neighbor.distance_m,
                    }
                    // Don't add neighbors if they're already friends
                    if (! markerArray.some(obj => obj.id === neighbor.id)) {
                        markerArray.push(markerData);
                    }
                });

                this.neighbors = neighbors;
                return markerArray;
            })
        );
    }

    // Called by the map whenever an ID is put it in the list of visible markers
    public idToObject(id: number): Neighbor {
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
            tool_count: 0
        };

        this.dataService.getNeighbor(id).subscribe(n => {
            Object.assign(neighbor, n);
            if (! n.imageUrl) {
                // Request/load the image
                this.dataService.loadImageUrl(neighbor, "default_neighbor.svg").subscribe();
            }
        });

        return neighbor;
    }

    // Called by the neighbor list when a neighbor is clicked
    public onListObjectClick(index: number): void {
        const mo: MappableObject | undefined = this.allVisibleObjects.get(index);

        if (mo) {
            const neighbor: Neighbor = mo as Neighbor;

            // Center and zoom the map on the clicked item
            this.map.setMapView([ neighbor.latitude, neighbor.longitude ], 18);

            const dialogConfig = new MatDialogConfig();
            dialogConfig.autoFocus = true;
            const data: FriendCardDialogData = {
                neighbor: neighbor,
                fnRequestFriendship: this.requestFriendship.bind(this),
                fnCancelRequestFriendship: this.cancelFriendshipRequest.bind(this),
                fnDeleteFriendship: this.deleteFriendship.bind(this),
            }
            dialogConfig.data = data;

            this.dialog.open(FriendCardComponent, dialogConfig);
        }
    }

    // Create a new friendship with the provided friend
    public requestFriendship(id: number, message: string) {
        // console.log("Creating friendship with: " + id);
        this.dataService.requestFriendship(id, message).subscribe(() => {
            const neighbor: Neighbor | undefined = this.neighbors.find(n => n.id == id);
            if (neighbor) {
                this.messageService.send('info', "Friendship requested with " + neighbor.name + "!");
            }

            // Refresh the map data (to flag the newly requested friend)
            this._getAllData().subscribe((markerData: MarkerData[]) => {
                this.markerData = markerData;
                this.map.markerData = this.markerData;
            });
        })
    }

    // Create a new friendship with the provided friend
    public cancelFriendshipRequest(id: number) {
        this.dataService.cancelFriendshipRequest(id).subscribe(() => {
            const neighbor: Neighbor | undefined = this.neighbors.find(n => n.id == id);
            if (neighbor) {
                this.messageService.send('info', "Friendship request with " + neighbor.name + " cancelled!");
            }

            // Refresh the map data (to flag the newly un-requested friend)
            this._getAllData().subscribe((markerData: MarkerData[]) => {
                this.markerData = markerData;
                this.map.markerData = this.markerData;
            });
        })
    }

    // Remove an existing friendship with the provided friend
    public deleteFriendship(id: number) {
        this.dataService.removeFriendship(id).subscribe(() => {
            const neighbor: Neighbor | undefined = this.neighbors.find(n => n.id == id);
            if (neighbor) {
                this.messageService.send('info', "Friendship with " + neighbor.name + " terminated!");
            }

            // Reload friends on the server
            this.dataService.expirefriends().subscribe(() => {
                // Refresh the map data
                this._getAllData().subscribe((markerData: MarkerData[]) => {
                    this.markerData = markerData;
                    this.map.markerData = this.markerData;
                });
            });
        });
    }

    // All objects in this component are Tools
    public asNeighbor(obj: MappableObject): Neighbor {
        return obj as Neighbor;
    }

}
