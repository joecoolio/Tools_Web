import { ChangeDetectorRef, Component, effect, ElementRef, inject, Injector, OnInit, QueryList, signal, Signal, ViewChild, ViewChildren, WritableSignal } from "@angular/core";
import { MapComponent, MarkerData } from "../map/map.component";
import { DataService, MappableObject, Neighbor, Tool } from "../services/data.service";
import { MatDialog, MatDialogConfig, MatDialogModule } from "@angular/material/dialog";
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";
import { forkJoin, map, Observable } from "rxjs";
import { BrowseObjectsComponent, MarkerDataWithDistance } from "../shared/browseobjects.component"
import { ToolCardComponent } from "../tool-card/tool-card.component";
import { SafeUrl } from "@angular/platform-browser";
import { k } from "../../../node_modules/@angular/material/module.d-m-qXd3m8";
import { MatTooltipModule } from "@angular/material/tooltip";

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
    ) {
        super(dataService, dialog, changeDetectorRef);
    }
    
    // Stuff for the map
    private readonly layerGroupNameTools: string = "Tools"; // All the tools
    readonly layerGroupNames: string[] = [ this.layerGroupNameTools ];

    // Get all data into this.markerData
    protected getAllData(): Observable<MarkerData[]> {
        return forkJoin([
            this.dataService.getAllTools(),    
        ])
        .pipe(
            map(([tools]) => {
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

}
