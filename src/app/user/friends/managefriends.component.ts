import { Component, ChangeDetectorRef } from "@angular/core";
import { DataService, MappableObject, MyInfo, Neighbor } from "../../services/data.service";
import { MapComponent, MarkerData } from "../../map/map.component";
import { MatCardModule } from "@angular/material/card";
import { Router, RouterModule } from "@angular/router";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { FriendCardComponent, FriendCardDialogData } from "../../friend-card/friend-card.component";
import { forkJoin, map, Observable } from "rxjs";
import { BrowseObjectsComponent, MarkerDataWithDistance } from "../../shared/browseobjects.component";
import { ResizeDirective } from "../../shared/resize-directive";
import { MessageService } from "../../services/message.service";
import { NeighborCardComponent } from "./neighborcard.component";
import { GlobalValuesService } from "../../shared/global-values";
import { FormsModule } from "@angular/forms";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

@Component({
    standalone: true,
    selector: 'app-manage-friends',
    imports: [
        RouterModule,
        MapComponent,
        MatCardModule,
        MatDialogModule,
        ResizeDirective,
        NeighborCardComponent,
        FormsModule,
        MatProgressSpinnerModule
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
        private router: Router,
        public globalValuesService: GlobalValuesService,
    ) {
        super(dataService, dialog, changeDetectorRef);

        // Get the provided radius (if it was provided)
        const nav = this.router.getCurrentNavigation();
        if (nav?.extras.state?.['radius']) {
            this.radius = nav?.extras.state?.['radius'];
        } else {
            // Default 1 mile
            this.radius = 1;
        }
    }
    // Stuff for the map
    private readonly layerGroupNameFriends: string = "Friends"; // My friends (and friends-of-friends)
    private readonly layerGroupNameNonFriends: string = "Others"; // Other neighbors
    readonly layerGroupNames: string[] = [ this.layerGroupNameFriends, this.layerGroupNameNonFriends ];
    
    // Radius in which to search
    radius!: number;

    // All the neighbors - in sync with what's provided in this.markerData.
    private neighbors: Neighbor[] = [];

    // Get all data into this.markerData.
    // Also put all the neighbor objects in this.neighbors.
    protected getAllData(): Observable<MarkerData[]> {
        return forkJoin([
            this.dataService.getFriends(this.radius),
            this.dataService.listNeighbors(this.radius),
            this.dataService.getMyInfo(),
        ])
        .pipe(
            map(([friends, neighbors, myinfoSignal]) => {
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

                // Add the search radius circle centered on my location
                let myInfo: MyInfo = myinfoSignal();
                let circle: MarkerDataWithDistance = {
                    markerType: "circle",
                    id: -1,
                    latitude: myInfo.latitude,
                    longitude: myInfo.longitude,
                    distance_m: 0,
                    color: "orange",
                    radius: this.radius * 1609.344,
                    layerGroupName: undefined, // This should be drawn directly on the map, not in a layer group
                    // Extra stuff that is ignored for circles
                    icon: "",
                    popupText: "",
                    onclick: function (id: number): void {},
                };
                markerArray.push(circle);

                this.neighbors = neighbors;
                return markerArray;
            })
        );
    }

    // Called by the map whenever an ID is put it in the list of visible markers
    public idToObject(id: number): Neighbor {
        return this.dataService.getOrCreateNeighbor(id);
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
            this.refreshData();
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
            this.refreshData();
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
                this.refreshData();
            });
        });
    }
   
    // Runs when the select changes
    public radiusChange(radius: number): void {
        this.radius = radius;
        this.refreshData().subscribe(() => {
            // Reset the map to recenter & show the provided radius
            this.map.setMapBounds(this.dataService.myInfoSignal().latitude, this.dataService.myInfoSignal().longitude, this.radius);
        });
    }
}
