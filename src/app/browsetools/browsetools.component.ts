import { ChangeDetectorRef, Component } from "@angular/core";
import { MapComponent, MarkerData } from "../map/map.component";
import { DataService, MappableObject, MyInfo, Tool } from "../services/data.service";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { MatCardModule } from "@angular/material/card";
import { Router, RouterModule } from "@angular/router";
import { forkJoin, map, Observable } from "rxjs";
import { BrowseObjectsComponent, MarkerDataWithDistance } from "../shared/browseobjects.component"
import { ToolCardComponent } from "../tool-card/tool-card.component";
import { SafeUrl } from "@angular/platform-browser";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ResizeDirective } from "../shared/resize-directive";
import { GlobalValuesService } from "../shared/global-values";
import { FormsModule } from "@angular/forms";

// A Tool with the owner's info appended
export interface ToolPlusOwner extends Tool {
    ownerName: string | undefined,
    ownerimageUrl: SafeUrl | undefined,
}

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

    // Radius in which to search
    radius!: number;
    
    // Stuff for the map
    private readonly layerGroupNameTools: string = "Tools"; // All the tools
    readonly layerGroupNames: string[] = [ this.layerGroupNameTools ];

    // Get all data into this.markerData
    protected getAllData(): Observable<MarkerData[]> {
        return forkJoin([
            this.dataService.getAllTools(),    
            this.dataService.getMyInfo(),
        ])
        .pipe(
            map(([tools, myinfoSignal]) => {
                let markerArray: MarkerData[] = [];

                // Filter tools by radius (convert miles to meters)
                const filteredTools = tools.filter(tool => tool.distance_m <= this.radius * 1609.344);

                // Process tools
                filteredTools.forEach(tool => {
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

                return markerArray;
            })
        );
    }

    // Called by the map whenever an ID is put it in the list of visible markers
    public idToObject(id: number): Tool {
        const tool: ToolPlusOwner = {
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
            ownerimageUrl: undefined
        };

        this.dataService.getTool(id).subscribe(
            t => {
                Object.assign(tool, t);
                if (! t.imageUrl) {
                    // Request/load the image
                    this.dataService.loadImageUrl(tool, "default_tool.svg").subscribe();

                    // Get the related neighbor & picture
                    this.dataService.getNeighbor(tool.owner_id).subscribe(neighbor => {
                        tool.ownerName = neighbor.name;
                        this.dataService.getPictureAsSafeUrl(neighbor.photo_link).subscribe(url => {
                            tool.ownerimageUrl = url;
                        })
                    });
                }
            }
        );

        return tool;
    }

    // Called by the neighbor list when a neighbor is clicked
    public onListObjectClick(index: number): void {
        const mo: MappableObject | undefined = this.allVisibleObjects.get(index);

        if (mo) {
            const tool: ToolPlusOwner = mo as ToolPlusOwner;

            // Center and zoom the map on the clicked item
            this.map.setMapView([ tool.latitude, tool.longitude ], 18);

            const dialogConfig = new MatDialogConfig();
            dialogConfig.autoFocus = true;
            dialogConfig.data = {
                tool: tool,
                fnBorrow: this.borrow.bind(this),
            }

            this.dialog.open(ToolCardComponent, dialogConfig);
        }
    }

    // Borrow a tool
    public borrow(id: number) {
        console.log("Borrowing: " + id);
        //TODO
    }

    // All objects in this component are Tools
    public asTool(obj: MappableObject): ToolPlusOwner {
        return obj as ToolPlusOwner;
    }

    // Runs when the select changes
    public radiusChange(radius: number): void {
        this.radius = radius;
        this.refreshData();
    }
}
