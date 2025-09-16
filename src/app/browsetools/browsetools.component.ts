import { ChangeDetectorRef, Component } from "@angular/core";
import { MapComponent, MarkerData } from "../map/map.component";
import { DataService, MappableObject, MyInfo, Tool } from "../services/data.service";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { MatCardModule } from "@angular/material/card";
import { Router, RouterModule } from "@angular/router";
import { forkJoin, map, Observable } from "rxjs";
import { BrowseObjectsComponent, MarkerDataWithDistance } from "../shared/browseobjects.component"
import { ToolCardComponent, ToolCardDialogData } from "../tool-card/tool-card.component";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ResizeDirective } from "../shared/resize-directive";
import { GlobalValuesService } from "../shared/global-values";
import { FormsModule } from "@angular/forms";
import { BrowseToolsToolCardComponent } from "./toolcard.component";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MessageService } from "../services/message.service";

@Component({
    standalone: true,
    selector: 'app-browse-tools',
    imports: [
    RouterModule,
    MapComponent,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
    ResizeDirective,
    FormsModule,
    BrowseToolsToolCardComponent,
    MatProgressSpinnerModule
],
    templateUrl: './browsetools.component.html',
    styleUrl: './browsetools.component.scss',
})
// A component that uses the map to show all of your direct linked friends.
export class BrowseToolsComponent extends BrowseObjectsComponent {
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

    /////
    // Search Criteria
    /////

    radius!: number; // Radius in which to search
    searchCriteria!: string; // Keyword search criteria
    searchWithAnd: string = "N"; // Y = use (a & b), N = (a | b)
    
    // All the neighbors - in sync with what's provided in this.markerData.
    private tools: Tool[] = [];

    // Stuff for the map
    private readonly layerGroupNameTools: string = "Tools"; // All the tools
    readonly layerGroupNames: string[] = [ this.layerGroupNameTools ];

    // Get all data into this.markerData
    protected getAllData(): Observable<MarkerData[]> {
        const searchArray: string[] = [];
        if (this.searchCriteria)
            searchArray.push(... this.searchCriteria.split(/\W+/).filter(Boolean));
        const searchAnd: boolean = this.searchWithAnd === "Y";

        return forkJoin([
            this.dataService.listTools(this.radius, searchArray, searchAnd),    
            this.dataService.getMyInfo(),
        ])
        .pipe(
            map(([tools, myinfoSignal]) => {
                let markerArray: MarkerData[] = [];

                // Process tools
                tools.forEach(tool => {
                    let markerData: MarkerDataWithDistance = {
                        layerGroupName: this.layerGroupNameTools,
                        id: tool.id,
                        latitude: tool.latitude,
                        longitude: tool.longitude,
                        icon: "fa-solid fa-screwdriver-wrench",
                        color: "green-dark",
                        popupText: "<div>Tool: " + tool.name + "</div>",
                        onclick: this.objectOnClick.bind(this), // Careful with the this reference
                        distance_m: tool.distance_m,
                    }
                    markerArray.push(markerData);
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

                this.tools = tools;

                return markerArray;
            })
        );
    }

    // Called by the map whenever an ID is put it in the list of visible markers
    public idToObject(id: number): Tool {
        return this.dataService.getOrCreateTool(id);
    }

    // Called by the neighbor list when a neighbor is clicked
    public onListObjectClick(index: number): void {
        const mo: MappableObject | undefined = this.allVisibleObjects.get(index);

        if (mo) {
            const tool: Tool = mo as Tool;

            // Center and zoom the map on the clicked item
            this.map.setMapView([ tool.latitude, tool.longitude ], 18);

            const dialogConfig = new MatDialogConfig();
            dialogConfig.autoFocus = true;
            const data: ToolCardDialogData = {
                tool: tool,
                fnBorrow: this.borrow.bind(this),
                fnCancelBorrow: this.cancelBorrow.bind(this),
            }
            dialogConfig.data = data;

            this.dialog.open(ToolCardComponent, dialogConfig);
        }
    }

    // Borrow a tool
    public borrow(id: number, message: string): void {
        console.log("Borrowing: " + id);
        this.dataService.borrowTool(id, message).subscribe(() => {
            const tool: Tool | undefined = this.tools.find(t => t.id == id);
            if (tool) {
                this.messageService.send('info', "Borrow request sent to " + tool.ownerName + "!");
            }

            // Refresh the map data (to flag the newly requested friend)
            this.refreshData();
        })
    }

    // Cancel a request to borrow a tool
    public cancelBorrow(id: number): void {
        console.log("Cancelling borrow: " + id);
        this.dataService.cancelBorrowRequest(id).subscribe(() => {
            const tool: Tool | undefined = this.tools.find(t => t.id == id);
            if (tool) {
                this.messageService.send('info', "Cancelled request to borrow " + tool.ownerName + "'s " + tool.short_name);
            }

            // Refresh the map data (to flag the newly requested friend)
            this.refreshData();
        })
    }

    // Runs when the input changes
    public searchCriteriaChange(radius: number, searchText: string, searchWithAnd: string): void {
        this.radius = radius;
        this.searchCriteria = searchText;
        this.searchWithAnd = searchWithAnd;

        this.refreshData().subscribe(() => {
            // Reset the map to recenter & show the provided radius
            this.map.setMapBounds(this.dataService.myInfoSignal().latitude, this.dataService.myInfoSignal().longitude, this.radius);
        });
    }
}
