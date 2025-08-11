import { AfterViewInit, Component, OnInit } from '@angular/core';
import {
  Map, Marker, Layer, tileLayer, MapOptions, latLng, icon, marker,
  ExtraMarkers,
  featureGroup,
  MarkerClusterGroup, MarkerClusterGroupOptions, markerClusterGroup,
  MarkerOptions,
  LayerGroup,
  layerGroup,
Control
} from 'leaflet';
import * as L from 'leaflet';
import 'leaflet-extra-markers';
import 'leaflet.markercluster';
import 'leaflet.markercluster.layersupport';
import { LeafletControlLayersConfig, LeafletDirective, LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import { Neighbor, DataService, Tool, MyInfo } from '../services/data.service';

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
    this.markerClusterGroup = markerClusterGroup.layerSupport();
    this.markerClusterGroup.addTo(map);

    this.markerClusterGroup.checkIn(this.meLayerGroup);
    this.markerClusterGroup.checkIn(this.toolsLayerGroup);
    this.markerClusterGroup.checkIn(this.neighborsLayerGroup);

    this.meLayerGroup.addTo(map);
    this.toolsLayerGroup.addTo(map);
    this.neighborsLayerGroup.addTo(map);

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
          const m: Marker = marker([tool.latitude, tool.longitude], {icon: icon });
          m.bindPopup(this.makeToolPopup(tool))

          this.toolsLayerGroup.addLayer(m);
        });
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

          this.neighborsLayerGroup.addLayer(m);
        });
      }
    );
  }

  layerControlReady($event: Control.Layers) {
    this.layerControl = $event;
    this.controlLayerConfig.overlays['Me'] = this.meLayerGroup;
    this.controlLayerConfig.overlays['Neighbors'] = this.neighborsLayerGroup;
    this.controlLayerConfig.overlays['Tools'] = this.toolsLayerGroup;
  }

}
