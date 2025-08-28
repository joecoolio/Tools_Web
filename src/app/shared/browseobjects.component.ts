import { ChangeDetectorRef, Component, effect, ElementRef, inject, Injector, OnInit, QueryList, signal, Signal, ViewChild, ViewChildren, WritableSignal } from "@angular/core";
import { MapComponent, MarkerData } from "../map/map.component";
import { DataService, MappableObject } from "../services/data.service";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from "@angular/router";
import { SortedArray } from "../services/sortedarray";
import { forkJoin, map, Observable } from "rxjs";
import { latLng, LatLng } from "leaflet";

// Extend the leaflet Marker to include a distance (in meters) from me.
export interface MarkerDataWithDistance extends MarkerData {
    distance_m: number,
}

@Component({
    standalone: true,
    imports: [
        RouterModule,
        MatCardModule,
        MatDialogModule,
    ],
    templateUrl: './browseobjects.component.html',
})
// A component that uses the map to show all of your objects.
// Extend this to handle whatever objects you like.
export abstract class BrowseObjectsComponent implements OnInit {
    // The main MapComponent
    @ViewChild('mapRef') map!: MapComponent;
    // The list of objects (fed by the map)
    @ViewChildren('objectCards', { read: ElementRef }) cards!: QueryList<ElementRef>;

    constructor(
        protected dataService: DataService,
        protected dialog: MatDialog,
        protected changeDetectorRef: ChangeDetectorRef,
    ) {}

    // Animation stuff
    objectCountBounceFlag: WritableSignal<boolean> = signal(false); // Set to true momentarily when the visible object count changes 

    // Stuff for the map
    protected defaultCenterLocation!: LatLng;
    protected defaultZoomLevel: number = 15;
    private readonly layerGroupNameMe: string = "Me"; // Layer holding me @ the center point
    protected abstract layerGroupNames: string[]; // The list of layers + "Me" layer
    protected markerData: MarkerData[] | undefined; // All of the markers to draw on the map

    // List of all visible friends & neighbors on the map
    private visibleObjects: globalThis.Map<string, SortedArray<MappableObject>> = new globalThis.Map(); // Map of layer name (e.g. Friends) -> object array
    allVisibleObjects: SortedArray<MappableObject> = new SortedArray<MappableObject>(this.sortFunction); // Combined list of all visible objects (for display)
    
    // Setup for the objectCountBounceFlag
    private injector = inject(Injector);
    allVisibleObjectsCount: Signal<number> = this.allVisibleObjects.sizeSignal;
    
    ngOnInit(): void {
        // Setup for the neighborCountBounceFlag.
        // This effect will momentarily set the bounce flag to true when the visible neighbor count changes.
        effect(() => {
            this.allVisibleObjectsCount(); // Link the effect to the proper signal so it functions
            this.objectCountBounceFlag.set(true);
            setTimeout(() => this.objectCountBounceFlag.set(false), 400);

        }, {injector: this.injector});

        // Get all the data!
        this._getAllData().subscribe((markerData: MarkerData[]) => {
            this.markerData = markerData;
        });

        // Setup the internal layer group names
        this.layerGroupNames = [ ...this.layerGroupNames, this.layerGroupNameMe ];
    }

    // Get all data from subclasses + the "Me" layer.
    // If you need a full reload of data, call this, not getAllData().
    protected _getAllData(): Observable<MarkerData[]> {
        return forkJoin([
            this.getAllData(),
            this.dataService.getMyInfo(),
        ])
        .pipe(
            map(([subclassArray, myinfo]) => {
                let markerArray: MarkerData[] = [];

                // Process subclass data
                subclassArray.forEach( markerData => markerArray.push(markerData) );

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

                // Sort it by distance from me
                return markerArray.sort(this.sortFunction);
            })
        );
    }
    
    // Get all data into this.markerData
    // Do not call this.
    protected abstract getAllData(): Observable<MarkerData[]>;

    // Provided to map to sort visible marker lists
    protected sortFunction(a:any, b:any) {
        return a.distance_m - b.distance_m
    };

    // Called by the map when the neighbor is clicked on
    public objectOnClick(id: number): void {
        const index = this.allVisibleObjects.findIndex(item => item.id === id);
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

    // Called by the map whenever an ID is put in the list of visible markers.
    // Load the object's data using whatever API calls are required.
    public abstract idToObject(id: number): MappableObject;

    // Called by the map when it's embedded leaflet map is ready
    public onReady(saMap: Map<string, SortedArray<any>>) {
        this.layerGroupNames.forEach(layerGroupName => {
            const sa: SortedArray<any> | undefined = saMap.get(layerGroupName);
            if (sa) {
                setTimeout(() => {
                    this.visibleObjects.set(layerGroupName, sa);
                    this.refreshAllVisibleObjects();
                });
            }
        });
    }

    // Called by the map whenever the visible layers are emptied
    public onVisibleLayersCleared(groupName: string) {
        setTimeout(() => {
            // Resync the allVisibleNeighbors array
            this.refreshAllVisibleObjects();
        });
    }

    // Called by the map whenever the visible layers are reloaded
    public onVisibleLayersRefreshed(groupName: string) {
        // Need to resort after loading new data
        setTimeout(() => {
            this.visibleObjects.get(groupName)?.resort();
            // Resync the allVisibleNeighbors array
            this.refreshAllVisibleObjects();
        });
    }

    // Called by the object list when an object is clicked
    protected abstract onListObjectClick(index: number): void;

    // Keep the list of all items in sync with the layer groups.
    // Exclude the "me" layer so I don't see myself in the list.
    private refreshAllVisibleObjects(): void {
        // Remove "me" from consideration
        const layerGroupNamesSubset = this.layerGroupNames.filter(name => name != this.layerGroupNameMe);

        const newItems: MappableObject[] = [];
        layerGroupNamesSubset.forEach(layerGroupName => {
            this.visibleObjects.get(layerGroupName)?.forEach(mappableObj => {
                newItems.push(mappableObj);
            });
        });
        this.allVisibleObjects.reload(newItems);
        this.changeDetectorRef.detectChanges();
    }
}
