import { AfterViewInit, ChangeDetectorRef, Component, Directive, inject, OnInit } from '@angular/core';
import {
  Map, Marker, Layer, tileLayer, MapOptions, latLng, icon, marker,
  ExtraMarkers,
  featureGroup,
  MarkerClusterGroup, MarkerClusterGroupOptions
} from 'leaflet';
import 'leaflet-extra-markers';
import 'leaflet.markercluster';
import { LeafletControlLayersConfig, LeafletDirective, LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import { Neighbor, DataService, Tool } from '../services/data.service';

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
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnInit, AfterViewInit {
  constructor(
    private dataService: DataService
  ) { }

  public map!: Map;

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

  // Always on layers (if any, if not, delete this)
  layers: Layer[] = [];

  // The tools cluster group
  toolsMarkerClusterGroup!: MarkerClusterGroup;
  toolsMarkerClusterData: Layer[] = [];

  // The neighbor cluster group
  neighborMarkerClusterGroup!: MarkerClusterGroup;
  neighborMarkerClusterData: Layer[] = [];

  // Shared cluster group options
  markerClusterOptions: MarkerClusterGroupOptions = {  };

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {

  }

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
  }

  toolsMarkerClusterReady(group: MarkerClusterGroup) {
    console.log("Tools marker cluster is ready");
    this.toolsMarkerClusterGroup = group;

    // Add the tools cluster to the layer control
    this.controlLayerConfig.overlays["Tools"] = this.toolsMarkerClusterGroup;

    // API call to get all the available tools
    console.log("Calling for tools");
    this.dataService.getAllTools().then(
      (tools: Tool[]) => {
        let markers: Marker[] = [];
        tools.forEach(tool => {
          const icon = ExtraMarkers.icon({
            icon: 'fa-solid ' + tool.category_icon,
            markerColor: 'red',
            shape: 'square',
            prefix: 'fa'
          });
          // const icon = icon({
          //   iconUrl: 'assets/toolcategory/' + tool.category_icon, // path to your icon image
          //   iconSize:     [40, 40],   // size of the icon
          //   iconAnchor:   [16, 32],   // point of the icon which corresponds to marker location
          //   popupAnchor:  [0, -32],   // point from which the popup should open relative to the iconAnchor
          //   // shadowUrl: 'assets/icons/marker-shadow.png', // optional
          //   shadowSize:   [41, 41],
          //   shadowAnchor: [12, 41],
          //   className: "leaflet_icon",
          // })
          const m: Marker = marker([tool.latitude, tool.longitude], {icon: icon });
          m.bindPopup(this.makeToolPopup(tool))

          markers.push(m);
        });
        console.log("# of tools: " + markers.length);

        // Reset the tools cluster group
        this.toolsMarkerClusterData = markers;

        // Recenter the map based on the tools
        if (this.toolsMarkerClusterData.length > 0) {
          this.map.fitBounds(featureGroup(markers).getBounds(), { padding: [40, 40] });
        }
      }
    );
  }

  neighborMarkerClusterReady(group: MarkerClusterGroup) {
    console.log("Neighbor marker cluster is ready");
    this.neighborMarkerClusterGroup = group;

    // Add the neighbors cluster to the layer control
    this.controlLayerConfig.overlays["Neighbors"] = group;

    // API call to get all the neighbors
    console.log("Calling for neighbors");
    this.dataService.listNeighbors().then(
      (neighbors: Neighbor[]) => {
        let markers: L.Marker[] = [];
        neighbors.forEach(neighbor => {
          const icon = ExtraMarkers.icon({
            icon: 'fa-solid fa-user-tie',
            markerColor: neighbor.is_friend ? 'green' : 'blue',
            shape: 'square',
            prefix: 'fa'
          });
          // const icon = icon({
          //   iconUrl: 'assets/toolcategory/' + tool.category_icon, // path to your icon image
          //   iconSize:     [40, 40],   // size of the icon
          //   iconAnchor:   [16, 32],   // point of the icon which corresponds to marker location
          //   popupAnchor:  [0, -32],   // point from which the popup should open relative to the iconAnchor
          //   // shadowUrl: 'assets/icons/marker-shadow.png', // optional
          //   shadowSize:   [41, 41],
          //   shadowAnchor: [12, 41],
          //   className: "leaflet_icon",
          // })
          const m: L.Marker = marker([neighbor.latitude, neighbor.longitude], {icon: icon });
          m.bindPopup(this.makeNeighborPopup(neighbor));

          markers.push(m);
        });
        console.log("# of neighbors: " + markers.length);

        // Reset the tools cluster group
        this.neighborMarkerClusterData = markers;

        // Recenter the map based on the tools
        if (this.neighborMarkerClusterData.length > 0) {
          this.map.fitBounds(featureGroup(markers).getBounds(), { padding: [40, 40] });
        }
      }
    );
  }

}
