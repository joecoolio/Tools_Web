import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import {
  Map, Marker, Layer, tileLayer, MapOptions, latLng, icon, marker, LayerGroup, layerGroup, // Default stuff
  ExtraMarkers, // Fancy markers
  MarkerClusterGroup, MarkerClusterGroupOptions, markerClusterGroup, // Cluster groups
  Control
} from 'leaflet';
import * as L from 'leaflet';
import 'leaflet-extra-markers';
import 'leaflet.markercluster';
import 'leaflet.markercluster.layersupport';
import 'leaflet-sidebar-v2';
import { LeafletControlLayersConfig, LeafletDirective, LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import { DataService } from '../services/data.service';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { SortedArray } from '../services/sortedarray';
import { HEX } from 'leaflet-extra-markers';

// The data required to draw something on the map.
// This will be converted to a marker when mapping.
export interface MarkerData {
    layerGroupName: string, // what label group to put this marker in
    id: number, // unique id for this guy
    latitude: number, // where to put it on the map
    longitude: number,
    icon: string, // e.g. 'fa-solid fa-hammer'
    // color on the map: e.g. 'red'
    /** Color of the marker (css class). Default value 'blue'. */
    color?: "red" | "orange-dark" | "orange" | "yellow" | "blue" | "blue-dark" | "cyan" | "purple"
                | "violet" | "pink" | "green-dark" | "green" | "green-light" | "black" | "white" | HEX,
    popupText: string, // some html for mouse over: e.g. `<div>Tool: Hammer</div>`;
    onclick: (id: number) => void
}

const iconRetinaUrl = 'leafassets/marker-icon-2x.png';

const iconUrl = 'leafassets/marker-icon.png';
const shadowUrl = 'leafassets/marker-shadow.png';
const iconDefault = icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
Marker.prototype.options.icon = iconDefault;

@Component({
  standalone: true,
  selector: 'app-map',
  imports: [
    LeafletDirective,
    LeafletModule,
    LeafletMarkerClusterModule,
    // CardComponent,
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnInit, AfterViewInit {
  constructor(
    private zone: NgZone,
    private changeDetector: ChangeDetectorRef,
    private dataService: DataService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
  ) { }

  // Inputs for map setup
  @Input() layerGroupNames!: string[]; // List of layer groups
  @Input() markerData!: MarkerData[]; // Data for markers
  @Input() sortFunction!: (o1: any, o2: any) => number; // For sorted arrays
  @Input() convertIdToObject!: (id: number) => any; // For sorted arrays

  // Emitters for a parent component
  // @Output() visibleNeighborsCleared = new EventEmitter<void>();
  // @Output() visibleToolsCleared = new EventEmitter<void>();
  @Output() ready = new EventEmitter<globalThis.Map<string, SortedArray<any>>>();
  @Output() visibleLayersCleared = new EventEmitter<string>();
  @Output() visibleLayersRefreshed = new EventEmitter<string>();

  public map!: Map;
  mapIsReady: boolean = false;

  // All of the different map options available
  private osmMap: Layer = tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
  private osmMapHot: Layer = tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France' });
  private otmMap: Layer = tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)' });

  // Leaflet map options
  options: MapOptions = {
    layers: [ this.osmMap ],
    zoom: 8,
    center: latLng(35.225946, -80.852852), // Bank of America stadium,
  };

  // Layer control
  layerControl!: Control.Layers;

  // Layer control config
  controlLayerConfig: LeafletControlLayersConfig = {
    baseLayers: {
      'Open Street Map': this.osmMap,
      'Open Street Map (HOT)': this.osmMapHot,
      'Open Topo Map': this.otmMap,
    },
    overlays: {} // These fill in when the API responses arrive
  };

  // Control layer options
  controlLayerOptions = {
    collapsed: false, // Keeps the control panel open
  }

  // The tools & neighbor layer groups
  // meLayerGroup: LayerGroup = layerGroup(); // Holds one layer showing me
  // toolsLayerGroup: LayerGroup = layerGroup();
  // neighborsLayerGroup: LayerGroup = layerGroup();
  layerGroups: globalThis.Map<string, LayerGroup> = new globalThis.Map();

  // The tools + neighbors cluster group
  markerClusterGroup!: MarkerClusterGroup.LayerSupport;

  // Shared cluster group options
  markerClusterOptions: MarkerClusterGroupOptions = {  };

  // // Sidebar
  // sidebar = L.control.sidebar({
  //   autopan: true,       // whether to maintain the centered map point when opening the sidebar
  //   closeButton: true,    // whether t add a close button to the panes
  //   container: 'sidebar', // the DOM container or #ID of a predefined sidebar container that should be used
  //   position: 'left',     // left or right
  // });

  // // Selected tool & neighbor for the sidebar to use
  // selectedTool !: Tool;
  // selectedNeighbor !: Neighbor;
  // selectedNeighborImageUrl !: SafeUrl;

  // All Markers that are in the current view
  // visibleTools: SortedArray<Tool> = new SortedArray((a:Tool, b:Tool) => { return a.distance_m - b.distance_m});
  // visibleNeighbors: SortedArray<Neighbor> = new SortedArray((a:Neighbor, b:Neighbor) => { return a.distance_m - b.distance_m});
  visibleLayers: globalThis.Map<string, SortedArray<any>> = new globalThis.Map();

  ngOnInit(): void {  }

  ngAfterViewInit(): void {  }

  // makeToolPopup(tool: Tool): string {
  //   return `` +
  //     `<div>Tool: ${ tool.name }</div>`;
  // }

  // makeNeighborPopup(neighbor: Neighbor): string {
  //   return `` +
  //     `<div>Neighbor: ${ neighbor.name }</div>`;
  // }

  onMapReady(map: Map) {
    console.log("Leaflet map is ready");

    this.map = map;
    this.mapIsReady = true;

    // Visible marker stuff
    this.map.on("overlayadd", (e) => this.refreshVisibleMarkers(e.name) );
    this.map.on("overlayremove", (e) => this.refreshVisibleMarkers(e.name) );

    // Marker cluster setup
    this.markerClusterGroup = markerClusterGroup.layerSupport();
    this.markerClusterGroup.addTo(map);

    // Add all layer groups to the marker cluster group
    // Then to the map
    // this.markerClusterGroup.checkIn(this.meLayerGroup);
    // this.markerClusterGroup.checkIn(this.toolsLayerGroup);
    // this.markerClusterGroup.checkIn(this.neighborsLayerGroup);
    this.layerGroupNames.forEach(lgName => {
      let lg: LayerGroup = layerGroup();
      this.layerGroups.set(lgName, lg);
      this.markerClusterGroup.checkIn(lg);
      lg.addTo(map);

      this.visibleLayers.set(lgName, new SortedArray<any>(this.sortFunction));
    })

    // this.meLayerGroup.addTo(map);
    // this.toolsLayerGroup.addTo(map);
    // this.neighborsLayerGroup.addTo(map);

    // // Sidebar setup
    // this.sidebar.addTo(map);

    // // Disable the selection panels
    // this.sidebar.disablePanel("selected_tool");

    // API calls
    // this.getMyInfo();
    // this.refreshData();

    console.log("Map is ready");
    this.ready.emit(this.visibleLayers);

    this.renderData();
  }
  
  private renderData() {
    this.markerData.forEach((md: MarkerData) => {
      const icon = ExtraMarkers.icon({
        icon: md.icon,
        markerColor: md.color,
        shape: 'square',
        prefix: 'fa'
      });
      const m: Marker = marker([md.latitude, md.longitude], { icon: icon });
      if (md.popupText != "") {
        m.bindPopup(md.popupText);
      }
      (m as any).id = md.id;
      m.on('click', event => md.onclick(md.id));
      const layerGroup = this.layerGroups.get(md.layerGroupName);
      if (layerGroup) {
        layerGroup.addLayer(m);
      } else {
        console.log("Trying to add layer to non-existant layer group: " + md.layerGroupName);
      }
    });

    this.refreshAllVisibleMarkers();
  }

  // private refreshData() {
  //   // API call to get all the available tools
  //   console.log("Calling for tools");
  //   this.dataService.getAllTools().then(
  //     (tools: Tool[]) => {
  //       console.log("# of tools: " + tools.length);
  //       this.toolsLayerGroup.clearLayers();

  //       tools.forEach(tool => {
  //         const icon = ExtraMarkers.icon({
  //           icon: 'fa-solid ' + tool.category_icon,
  //           markerColor: 'red',
  //           shape: 'square',
  //           prefix: 'fa'
  //         });
  //         const m: Marker = marker([tool.latitude, tool.longitude], { icon: icon });
  //         m.bindPopup(this.makeToolPopup(tool));
  //         (m as any).id = tool.id; // Stick the ID of the tool on the object
  //         m.on('click', event => this.toolOnClick(event));

  //         this.toolsLayerGroup.addLayer(m);
  //       });

  //       this.refreshVisibleMarkers("Tools");
  //     }
  //   );

  //   // API call to get all the neighbors
  //   console.log("Calling for neighbors");
  //   this.dataService.listNeighbors().then(
  //     (neighbors: Neighbor[]) => {
  //       console.log("# of neighbors: " + neighbors.length);
  //       this.neighborsLayerGroup.clearLayers();

  //       neighbors.forEach(neighbor => {
  //         const icon = ExtraMarkers.icon({
  //           icon: 'fa-solid fa-user-tie',
  //           markerColor: neighbor.is_friend ? 'green' : 'blue',
  //           shape: 'square',
  //           prefix: 'fa'
  //         });
  //         const m: L.Marker = marker([neighbor.latitude, neighbor.longitude], {icon: icon });
  //         m.bindPopup(this.makeNeighborPopup(neighbor));
  //         (m as any).id = neighbor.id; // Stick the ID of the neighbor on the object
  //         m.on('click', event => this.neighborOnClick(event));

  //         this.neighborsLayerGroup.addLayer(m);
  //       });

  //       this.refreshVisibleMarkers("Neighbors");
  //     }
  //   );
  // }

  layerControlReady($event: Control.Layers) {
    this.layerControl = $event;
    // this.controlLayerConfig.overlays['Me'] = this.meLayerGroup;
    // this.controlLayerConfig.overlays['Neighbors'] = this.neighborsLayerGroup;
    // this.controlLayerConfig.overlays['Tools'] = this.toolsLayerGroup;
    this.layerGroupNames.forEach((name: string) => {
      let layerGroup: LayerGroup | undefined = this.layerGroups.get(name);
      if (layerGroup) {
        this.controlLayerConfig.overlays[name] = layerGroup;
      }
    });
  }

  // This fires when you click on the map background.
  // I'm using it to un-select a tool/neighbor
  onMapClick($event: L.LeafletMouseEvent) {
    // console.log("User clicked on map: " + $event);
    // this.sidebar.close();
    // this.sidebar.disablePanel("selected_tool");
    // this.sidebar.disablePanel("selected_neighbor");
  }

  // User clicked on a tool
  // toolOnClick($event: L.LeafletMouseEvent) {
  //   let id: number = $event.target.id;
    
  // // [name]="'Charmander'"
  // // [type]="'fire'"
  // // [hp]="50"
  // // [attack]="'Ember'"
  // // [damage]="40"
  // // [description]="'Charmander’s tail flame shows its life force. It flares up in battle.'"
  // // [imageUrl]="'https://assets.pokemon.com/assets/cms2/img/pokedex/full/004.png'"

  //   console.log("User clicked on tool: " + id);

  //   // // Center the map on the clicked item
  //   // console.log($event.target.getLatLng());
  //   // console.log("before: " + this.map.latLngToContainerPoint($event.target.getLatLng()));
  //   // this.map.setView($event.target.getLatLng(), 15);
  //   // console.log("after: " + this.map.latLngToContainerPoint($event.target.getLatLng()));

  //   // const dialogConfig = new MatDialogConfig();
  //   // dialogConfig.autoFocus = true;
  //   // dialogConfig.data = {
  //   //   requestType: "tool",
  //   //   id: id,
  //   // }

  //   // this.dialog.open(CardComponent, dialogConfig);
  //   this.dataService.getTool(id).then(
  //     (tool: Tool) => {
  //       console.log("Retrieved tool: " + tool.id);
  //       // this.zone.run(() => {
  //         this.selectedTool = tool;
  //       // });
  //       this.changeDetector.detectChanges();

  //       this.sidebar.enablePanel("selected_tool");
  //       this.sidebar.open("selected_tool");
  //     }
  //   );
  // }

  // // User clicked on a neighbor
  // neighborOnClick($event: L.LeafletMouseEvent) {
  //   let id: number = $event.target.id;
    
  //   console.log("User clicked on neighbor: " + id);

  //   this.dataService.getNeighbor(id).then(
  //     (neighbor: Neighbor) => {
  //       console.log("Retrieved neighbor: " + neighbor.id);
  //       this.selectedNeighbor = neighbor;

  //       this.changeDetector.detectChanges();

  //       this.sidebar.enablePanel("selected_neighbor");
  //       this.sidebar.open("selected_neighbor");

  //       // Request the image
  //       if(! this.selectedNeighbor.photo_link) {
  //         this.selectedNeighbor.photo_link = "default.svg";
  //       }
  //       this.dataService.getPicture(this.selectedNeighbor.photo_link).then(
  //         (blob: Blob) => {
  //           const objectURL = URL.createObjectURL(blob);
  //           this.selectedNeighborImageUrl = this.sanitizer.bypassSecurityTrustUrl(objectURL);

  //           this.changeDetector.detectChanges();
  //         }
  //       );

  //     }
  //   );
  // }

  // Re-populate the list of visible markers.
  // Spin through every layer on the LayerGroup, check the
  // lat & long of each, and add all the visible ones to
  // the sortedArray.
  refreshVisibleMarkers(overlayName: string) {
    if (this.mapIsReady) {
      var bounds = this.map.getBounds();

      const sortedArray: SortedArray<any> | undefined = this.visibleLayers.get(overlayName);
      const layerGroup: LayerGroup | undefined = this.layerGroups.get(overlayName);

      if (sortedArray && layerGroup) {
        this.zone.run(() => {
          sortedArray.clear();
          this.visibleLayersCleared.emit(overlayName);
        });

        if (this.map.hasLayer(layerGroup)) {
          layerGroup.eachLayer((layer: Layer) => {
            if (layer instanceof Marker) {
              let marker: Marker = (layer as Marker);
              if(bounds.contains(marker.getLatLng())) {
                this.zone.run(() => {
                  sortedArray.add(this.convertIdToObject((marker as any).id));
                });
              }
            }
          });

          // this.zone.run(() => {
            this.visibleLayersRefreshed.emit(overlayName);
          // });
        }
      }
    }



    // if (this.mapIsReady) {
    //   var bounds = this.map.getBounds();

    //   if (overlayName == "Neighbors") {
    //     this.zone.run(() => {
    //       this.visibleNeighbors.clear();
    //       this.visibleNeighborsCleared.emit();
    //     });
        
    //     if (this.map.hasLayer(this.neighborsLayerGroup)) {
    //       this.neighborsLayerGroup.eachLayer((layer: Layer) => {
    //         if (layer instanceof Marker) {
    //           let marker: Marker = (layer as Marker);
    //           if(bounds.contains(marker.getLatLng())) {
    //             this.zone.run(() => {
    //               this.visibleNeighbors.add(this.markerToNeighbor(marker));
    //             });
    //           }
    //         }
    //       });
    //     }
    //   }

    //   if (overlayName == "Tools") {
    //     this.zone.run(() => {
    //       this.visibleTools.clear();
    //       this.visibleToolsCleared.emit();
    //     });
        
    //     if (this.map.hasLayer(this.toolsLayerGroup)) {
    //       this.toolsLayerGroup.eachLayer((layer: Layer) => {
    //         if (layer instanceof Marker) {
    //           let marker: Marker = (layer as Marker);
    //           if(bounds.contains(marker.getLatLng())) {
    //             this.zone.run(() => {
    //               this.visibleTools.add(this.markerToTool(marker));
    //             });
    //           }
    //         }
    //       });
    //     }
    //   }
    // }
  }

  refreshAllVisibleMarkers() {
    this.layerGroupNames.forEach((layerGroupName: string) => {
      const layerGroup = this.layerGroups.get(layerGroupName);
      if (layerGroup) {
        console.log("Refresh visible: " + layerGroupName);
        this.refreshVisibleMarkers(layerGroupName);
      }
    });
    // this.refreshVisibleMarkers("Neighbors");
    // this.refreshVisibleMarkers("Tools");
  }

  // Reset the map center point & zoom.
  // This is just a passthrough to the map.
  public setMapView(center: L.LatLngExpression, zoom?: number, options?: L.ZoomPanOptions) {
    this.map.setView(center, zoom, options);
  }

  // // Convert a Marker to a Neighbor (via an API call)
  // private markerToNeighbor(marker: Marker): Neighbor {
  //   const id = (marker as any).id;
  //   const neighbor: Neighbor = {
  //     id: id,
  //     name: '',
  //     photo_link: '',
  //     latitude: 0,
  //     longitude: 0,
  //     home_address: '',
  //     distance_m: 9999,
  //     is_friend: false,
  //     imageUrl: undefined
  //   }

  //   this.dataService.getNeighbor(id).then(
  //     (n: Neighbor) => {
  //       Object.assign(neighbor, n);
  //       this.visibleNeighbors.resort(); // Need to resort after loading the neighbor's data

  //       if (! n.imageUrl) {
  //         // Request the image
  //         if(! n.photo_link) {
  //           n.photo_link = "default.svg";
  //         }
  //         this.dataService.getPicture(n.photo_link).then(
  //           (blob: Blob) => {
  //             const objectURL = URL.createObjectURL(blob);
  //             neighbor.imageUrl = this.sanitizer.bypassSecurityTrustUrl(objectURL);
  //           }
  //         );
  //       }
  //     }
  //   );

  //   return neighbor;
  // }

  // Convert a Marker to a Tool (via an API call)
  // private markerToTool(marker: Marker): Tool {
  //   const id = (marker as any).id;
  //   const tool: Tool = {
  //     id: id,
  //     owner_id: 0,
  //     name: '',
  //     product_url: '',
  //     replacement_cost: 0,
  //     category: '',
  //     category_icon: '',
  //     latitude: 0,
  //     longitude: 0,
  //     distance_m: 0
  //   };
 
  //   this.dataService.getTool(id).then(
  //     (t: Tool) => {
  //       Object.assign(tool, t);
  //     }
  //   );

  //   return tool;
  // }

}
