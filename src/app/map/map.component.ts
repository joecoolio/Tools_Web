import { AfterViewInit, ChangeDetectorRef, Component, Directive, inject, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-extra-markers';
import 'leaflet.markercluster';
import { MarkerService, ToolResult } from '../services/marker.service';
import { LeafletDirective, LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';

const iconRetinaUrl = 'leafassets/marker-icon-2x.png';

const iconUrl = 'leafassets/marker-icon.png';
const shadowUrl = 'leafassets/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  standalone: true,
  selector: 'app-map',
  imports: [
    LeafletDirective,
    LeafletModule,
    LeafletMarkerClusterModule
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnInit, AfterViewInit {
  constructor(private markerService: MarkerService) { }

  private map!: L.Map;

  // Leaflet map options
  options = {
    layers: [
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 3,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      })
    ],
    zoom: 5,
    // center: L.latLng(46.879966, -121.726909)
  };

  // Always on layers (if any, if not, delete this)
  layers: L.Layer[] = [];

  // The tools cluster group
  toolsMarkerClusterGroup!: L.MarkerClusterGroup;
  toolsMarkerClusterData: L.Layer[] = [];

  // The neighbor cluster group
  neighborMarkerClusterGroup!: L.MarkerClusterGroup;
  neighborMarkerClusterData: L.Layer[] = [];

  // Shared cluster group options
  markerClusterOptions: L.MarkerClusterGroupOptions = {};

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.markerService.getAllTools().then(
      (tools: ToolResult[]) => {
        let markers: L.Marker[] = [];
        tools.forEach(tool => {
          const icon = L.ExtraMarkers.icon({
            icon: 'fa-solid ' + tool.category_icon,
            markerColor: 'red',
            shape: 'square',
            prefix: 'fa'
          });
          // const icon = L.icon({
          //   iconUrl: 'assets/toolcategory/' + tool.category_icon, // path to your icon image
          //   iconSize:     [40, 40],   // size of the icon
          //   iconAnchor:   [16, 32],   // point of the icon which corresponds to marker location
          //   popupAnchor:  [0, -32],   // point from which the popup should open relative to the iconAnchor
          //   // shadowUrl: 'assets/icons/marker-shadow.png', // optional
          //   shadowSize:   [41, 41],
          //   shadowAnchor: [12, 41],
          //   className: "leaflet_icon",
          // })
          const marker: L.Marker = L.marker([tool.latitude, tool.longitude], {icon: icon });
          marker.bindPopup(this.makeToolPopup(tool))

          markers.push(marker);
        });

        // Reset the tools cluster group
        this.toolsMarkerClusterData = markers;

        // Recenter the map based on the tools
        this.map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [40, 40] });
      }
    );
  }

  makeToolPopup(tool: ToolResult): string {
    return `` +
      `<div>Tool: ${ tool.name }</div>`;
  }

  onMapReady(map: L.Map) {
    this.map = map;
  }
  toolsMarkerClusterReady(group: L.MarkerClusterGroup) {
    this.toolsMarkerClusterGroup = group;
  }

}
