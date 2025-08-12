import { AfterViewInit, ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import {
  Map, Marker, MarkerOptions, Layer, tileLayer, MapOptions, latLng, icon, marker, LayerGroup, layerGroup, // Default stuff
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
import { Neighbor, DataService, Tool, MyInfo } from '../services/data.service';
import { CardComponent } from '../card/card.component';
import { MatDialog, MatDialogConfig, MatDialogModule } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';


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
    CardComponent,
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
  meLayerGroup: LayerGroup = layerGroup(); // Holds one layer showing me
  toolsLayerGroup: LayerGroup = layerGroup();
  neighborsLayerGroup: LayerGroup = layerGroup();

  // The tools + neighbors cluster group
  markerClusterGroup!: MarkerClusterGroup.LayerSupport;

  // Shared cluster group options
  markerClusterOptions: MarkerClusterGroupOptions = {  };

  // Sidebar
  sidebar = L.control.sidebar({
    autopan: true,       // whether to maintain the centered map point when opening the sidebar
    closeButton: true,    // whether t add a close button to the panes
    container: 'sidebar', // the DOM container or #ID of a predefined sidebar container that should be used
    position: 'left',     // left or right
  });

  // Selected tool & neighbor for the sidebar to use
  selectedTool !: Tool;
  selectedNeighbor !: Neighbor;
  selectedNeighborImageUrl !: SafeUrl;

  // All Markers that are in the current view
  visibleTools: Marker[] = [];
  visibleNeighbors: Marker[] = [];

  ngOnInit(): void {  }

  ngAfterViewInit(): void {  }

  makeToolPopup(tool: Tool): string {
    return `` +
      `<div>Tool: ${ tool.name }</div>`;
  }

  makeNeighborPopup(neighbor: Neighbor): string {
    return `` +
      `<div>Neighbor: ${ neighbor.name }</div>`;
  }

  onMapReady(map: Map) {
    console.log("Map is ready");
    this.map = map;
    this.mapIsReady = true;

    // Visible marker stuff
    this.map.on("overlayadd", (e) => this.refreshVisibleMarkers(e.name) );
    this.map.on("overlayremove", (e) => this.refreshVisibleMarkers(e.name) );

    // Marker cluster setup
    this.markerClusterGroup = markerClusterGroup.layerSupport();
    this.markerClusterGroup.addTo(map);

    this.markerClusterGroup.checkIn(this.meLayerGroup);
    this.markerClusterGroup.checkIn(this.toolsLayerGroup);
    this.markerClusterGroup.checkIn(this.neighborsLayerGroup);

    this.meLayerGroup.addTo(map);
    this.toolsLayerGroup.addTo(map);
    this.neighborsLayerGroup.addTo(map);

    // Sidebar setup
    this.sidebar.addTo(map);

    // Disable the selection panels
    this.sidebar.disablePanel("selected_tool");

    // let panelContent: Control.PanelOptions = {
    //   id: 'userinfo',                     // UID, used to access the panel
    //   tab: '<i class="fa fa-gear"></i>',  // content can be passed as HTML string,
    //   title: 'Your Profile',              // an optional pane header
    //   position: 'top'                  // optional vertical alignment, defaults to 'top'
    // };
    // this.sidebar.addPanel(panelContent);

//     /* add an external link */
// this.sidebar.addPanel({
//     id: 'ghlink',
//     tab: '<i class="fa fa-github"></i>',
//     button: 'https://github.com/noerw/leaflet-sidebar-v2',
// });

// /* add a button with click listener */
// this.sidebar.addPanel({
//     id: 'click',
//     tab: '<i class="fa fa-info"></i>',
//     button: function (event) { console.log(event); }
// });

    // API calls
    this.getMyInfo();
    this.refreshData();
  }
  
  private getMyInfo() {
    console.log("Calling for my info");
    this.dataService.getMyInfo().then(
      (myinfo: MyInfo) => {
        this.meLayerGroup.clearLayers();
        const icon = ExtraMarkers.icon({
          icon: 'fa-solid fa-face-grin-wide',
          markerColor: 'orange',
          shape: 'square',
          prefix: 'fa'
        });
        const m: Marker = marker([myinfo.latitude, myinfo.longitude], {icon: icon });
        this.meLayerGroup.addLayer(m);

        // Center & zoom the map on my location
        this.map.setView([myinfo.latitude, myinfo.longitude], 15);
      }
    )
  }

  private refreshData() {
    // API call to get all the available tools
    console.log("Calling for tools");
    this.dataService.getAllTools().then(
      (tools: Tool[]) => {
        console.log("# of tools: " + tools.length);
        this.toolsLayerGroup.clearLayers();

        tools.forEach(tool => {
          const icon = ExtraMarkers.icon({
            icon: 'fa-solid ' + tool.category_icon,
            markerColor: 'red',
            shape: 'square',
            prefix: 'fa'
          });
          var x: MarkerOptions = {

          }
          const m: Marker = marker([tool.latitude, tool.longitude], { icon: icon });
          m.bindPopup(this.makeToolPopup(tool));
          (m as any).id = tool.id; // Stick the ID of the tool on the object
          m.on('click', event => this.toolOnClick(event));

          this.toolsLayerGroup.addLayer(m);
        });

        this.refreshVisibleMarkers("Tools");
      }
    );

    // API call to get all the neighbors
    console.log("Calling for neighbors");
    this.dataService.listNeighbors().then(
      (neighbors: Neighbor[]) => {
        console.log("# of neighbors: " + neighbors.length);
        this.neighborsLayerGroup.clearLayers();

        neighbors.forEach(neighbor => {
          const icon = ExtraMarkers.icon({
            icon: 'fa-solid fa-user-tie',
            markerColor: neighbor.is_friend ? 'green' : 'blue',
            shape: 'square',
            prefix: 'fa'
          });
          const m: L.Marker = marker([neighbor.latitude, neighbor.longitude], {icon: icon });
          m.bindPopup(this.makeNeighborPopup(neighbor));
          (m as any).id = neighbor.id; // Stick the ID of the neighbor on the object
          m.on('click', event => this.neighborOnClick(event));

          this.neighborsLayerGroup.addLayer(m);
        });

        this.refreshVisibleMarkers("Neighbors");
      }
    );
  }

  layerControlReady($event: Control.Layers) {
    this.layerControl = $event;
    this.controlLayerConfig.overlays['Me'] = this.meLayerGroup;
    this.controlLayerConfig.overlays['Neighbors'] = this.neighborsLayerGroup;
    this.controlLayerConfig.overlays['Tools'] = this.toolsLayerGroup;
  }

  // This fires when you click on the map background.
  // I'm using it to un-select a tool/neighbor
  onMapClick($event: L.LeafletMouseEvent) {
    console.log("User clicked on map: " + $event);
    this.sidebar.close();
    this.sidebar.disablePanel("selected_tool");
    this.sidebar.disablePanel("selected_neighbor");
  }

  // User clicked on a tool
  toolOnClick($event: L.LeafletMouseEvent) {
    let id: number = $event.target.id;
    
  // [name]="'Charmander'"
  // [type]="'fire'"
  // [hp]="50"
  // [attack]="'Ember'"
  // [damage]="40"
  // [description]="'Charmander’s tail flame shows its life force. It flares up in battle.'"
  // [imageUrl]="'https://assets.pokemon.com/assets/cms2/img/pokedex/full/004.png'"

    console.log("User clicked on tool: " + id);

    // // Center the map on the clicked item
    // console.log($event.target.getLatLng());
    // console.log("before: " + this.map.latLngToContainerPoint($event.target.getLatLng()));
    // this.map.setView($event.target.getLatLng(), 15);
    // console.log("after: " + this.map.latLngToContainerPoint($event.target.getLatLng()));

    // const dialogConfig = new MatDialogConfig();
    // dialogConfig.autoFocus = true;
    // dialogConfig.data = {
    //   requestType: "tool",
    //   id: id,
    // }

    // this.dialog.open(CardComponent, dialogConfig);
    this.dataService.getTool(id).then(
      (tool: Tool) => {
        console.log("Retrieved tool: " + tool.id);
        // this.zone.run(() => {
          this.selectedTool = tool;
        // });
        this.changeDetector.detectChanges();

        this.sidebar.enablePanel("selected_tool");
        this.sidebar.open("selected_tool");
      }
    );
  }

  // User clicked on a neighbor
  neighborOnClick($event: L.LeafletMouseEvent) {
    let id: number = $event.target.id;
    
    console.log("User clicked on neighbor: " + id);

    this.dataService.getNeighbor(id).then(
      (neighbor: Neighbor) => {
        console.log("Retrieved neighbor: " + neighbor.id);
        this.selectedNeighbor = neighbor;

        this.changeDetector.detectChanges();

        this.sidebar.enablePanel("selected_neighbor");
        this.sidebar.open("selected_neighbor");

        // Request the image
        if(! this.selectedNeighbor.photo_link) {
          this.selectedNeighbor.photo_link = "default.svg";
        }
        this.dataService.getPicture(this.selectedNeighbor.photo_link).then(
          (blob: Blob) => {
            const objectURL = URL.createObjectURL(blob);
            this.selectedNeighborImageUrl = this.sanitizer.bypassSecurityTrustUrl(objectURL);

            this.changeDetector.detectChanges();
          }
        );

      }
    );
  }

  // Re-populate the list of visible markers
  refreshVisibleMarkers(overlayName: string) {
    if (this.mapIsReady) {
      var bounds = this.map.getBounds();

      if (overlayName == "Neighbors") {
        this.visibleNeighbors = [];
        
        if (this.map.hasLayer(this.neighborsLayerGroup)) {
          this.neighborsLayerGroup.eachLayer((layer: Layer) => {
            if (layer instanceof Marker) {
              let marker: Marker = (layer as Marker);
              if(bounds.contains(marker.getLatLng())) {
                this.visibleNeighbors.push(marker);
              }
            }
          });
        }
      }

      if (overlayName == "Tools") {
        this.visibleTools = [];
        
        if (this.map.hasLayer(this.toolsLayerGroup)) {
          this.toolsLayerGroup.eachLayer((layer: Layer) => {
            if (layer instanceof Marker) {
              let marker: Marker = (layer as Marker);
              if(bounds.contains(marker.getLatLng())) {
                this.visibleTools.push(marker);
              }
            }
          });
        }
      }

      console.log("Number of visible markers: Tools: " + this.visibleTools.length + " / Neighbors: " + this.visibleNeighbors.length);
    }
  }

  refreshAllVisibleMarkers() {
    this.refreshVisibleMarkers("Neighbors");
    this.refreshVisibleMarkers("Tools");
  }

}
