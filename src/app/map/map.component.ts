import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { LeafletControlLayersConfig, LeafletDirective, LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster.layersupport';
import 'leaflet-extra-markers';
import {
  Map, Marker, Layer, tileLayer, MapOptions, icon, marker, LayerGroup, layerGroup, // Default stuff
  ExtraMarkers, // Fancy markers
  MarkerClusterGroup, MarkerClusterGroupOptions, // Cluster groups
  Control
} from 'leaflet';
import { SortedArray } from '../services/sortedarray';
import { HEX } from 'leaflet-extra-markers';

// The data required to draw something on the map.
// This will be converted to a marker when mapping.
export interface MarkerData {
  markerType?: "marker" | "circle",
  layerGroupName: string | undefined, // what label group to put this marker in, undefined means directly on the map
  id: number, // unique id for this guy
  latitude: number, // where to put it on the map
  longitude: number,
  icon: string, // e.g. 'fa-solid fa-hammer'
  // color on the map: e.g. 'red'
  /** Color of the marker (css class). Default value 'blue'. */
  color?: "red" | "orange-dark" | "orange" | "yellow" | "blue" | "blue-dark" | "cyan" | "purple"
              | "violet" | "pink" | "green-dark" | "green" | "green-light" | "black" | "white" | HEX,
  popupText: string, // some html for mouse over: e.g. `<div>Tool: Hammer</div>`;
  onclick: (id: number) => void,
  radius?: number, // For circles, what is the radius
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
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges {
  constructor(
    private zone: NgZone,
  ) { }

  // Inputs for map setup
  @Input() layerGroupNames!: string[]; // List of layer groups
  @Input() defaultCenterLocation!: L.LatLng; // Where the map is centered at startup
  @Input() defaultZoomLevel!: number; // Default zoom level
  @Input() markerData!: MarkerData[]; // Data for markers
  @Input() sortFunction!: (o1: any, o2: any) => number; // For sorted arrays
  @Input() convertIdToObject!: (id: number) => any; // For sorted arrays, convert a single item to an object of the proper type

  // Emitters for a parent component
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
  options!: MapOptions;

  // Layer control
  layerControl!: Control.Layers;

  // Layer control config
  controlLayerConfig: LeafletControlLayersConfig = {
    baseLayers: {
      'Open Street Map': this.osmMap,
      'Open Street Map (HOT)': this.osmMapHot,
      'Open Topo Map': this.otmMap,
    },
    overlays: {}
  };

  // Control layer options
  controlLayerOptions = {
    collapsed: false, // Keeps the control panel open
  }

  // The set of layer groups
  layerGroups: globalThis.Map<string, LayerGroup> = new globalThis.Map();

  // Some things aren't drawn in layer groups (e.g. circles)
  // Store them here so you can remove and replace them when needed.
  nonGroupLayers: Layer[] = [];

  // The tools + neighbors cluster group
  markerClusterGroup!: MarkerClusterGroup.LayerSupport;

  // Shared cluster group options
  markerClusterOptions: MarkerClusterGroupOptions = {  };

  // All Markers that are in the current view
  visibleLayers: globalThis.Map<string, SortedArray<any>> = new globalThis.Map();

  ngOnInit(): void { 
    // Default map options
    this.options = {
      layers: [ this.osmMap ],
      zoom: this.defaultZoomLevel,
      center: this.defaultCenterLocation,
    };
  }

  ngAfterViewInit(): void {  }

  // Re-render when the marker data changes
  ngOnChanges(changes: SimpleChanges): void {
    if (this.mapIsReady && changes['markerData']) {
      this.renderData();
    }
  }

  onMapReady(map: Map) {
    // console.log("Leaflet map is ready");

    this.map = map;
    this.mapIsReady = true;

    // Visible marker stuff
    this.map.on("overlayadd", (e) => this.refreshVisibleMarkers(e.name) );
    this.map.on("overlayremove", (e) => this.refreshVisibleMarkers(e.name) );

    // Marker cluster setup
    this.markerClusterGroup = L.markerClusterGroup.layerSupport();
    this.markerClusterGroup.addTo(map);

    // Add all layer groups to the marker cluster group
    // Then to the map
    this.layerGroupNames.forEach(lgName => {
      let lg: LayerGroup = layerGroup();
      this.layerGroups.set(lgName, lg);
      this.markerClusterGroup.checkIn(lg);
      lg.addTo(map);

      this.visibleLayers.set(lgName, new SortedArray<any>(this.sortFunction));
    })

    this.ready.emit(this.visibleLayers);

    this.renderData();
  }
  
  public renderData() {
    // Remove old stuff
    this.layerGroups.forEach(layerGroup => layerGroup.clearLayers());
    this.nonGroupLayers.forEach(layer => this.map.removeLayer(layer));

    // Add new stuff
    this.markerData.forEach((md: MarkerData) => {
      let layer: Layer | undefined = undefined; // The layer we're going to draw on the map

      // Draw markers
      if (!md.markerType || md.markerType == "marker") {
        const icon = ExtraMarkers.icon({
          icon: md.icon,
          markerColor: md.color,
          shape: 'square',
          prefix: 'fa'
        });
        layer = marker([md.latitude, md.longitude], { icon: icon });
        if (md.popupText != "") {
          layer.bindPopup(md.popupText);
        }
        (layer as any).id = md.id;
        layer.on('click', () => md.onclick(md.id));
      }

      // Draw circles directly on the map.
      // These do not go into layer groups because you can't see them rolled up.
      if (md.markerType == "circle" && md.radius) {
        layer = L.circle([md.latitude, md.longitude], {
          color: md.color,
          fillOpacity: 0.08,
          radius: md.radius
        });
      }

      // Figure out where to put the new layer, either in a layergroup or directly on the map
      if (layer) {
        if (md.layerGroupName) {
          const layerGroup = this.layerGroups.get(md.layerGroupName);
          if (layerGroup) {
            layerGroup.addLayer(layer);
          } else {
            console.log("Trying to add layer to non-existant layer group: " + md.layerGroupName);
          }
        } else {
          // Undefined layer group means add it directly to the map
          this.nonGroupLayers.push(layer);
          this.map.addLayer(layer);
        }
      }
    });

    this.map.invalidateSize(); // Makes the leaflet map re-draw
    this.refreshAllVisibleMarkers();
  }

  layerControlReady($event: Control.Layers) {
    this.layerControl = $event;
    this.layerGroupNames.forEach((name: string) => {
      let layerGroup: LayerGroup | undefined = this.layerGroups.get(name);
      if (layerGroup) {
        this.controlLayerConfig.overlays[name] = layerGroup;
      }
    });
  }

  // This fires when you click on the map background.
  onMapClick($event: L.LeafletMouseEvent) {
  }

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
        const newArray: any[] = [];

        if (this.map.hasLayer(layerGroup)) {
          layerGroup.eachLayer((layer: Layer) => {
            if (layer instanceof Marker) {
              let marker: Marker = (layer as Marker);
              if(bounds.contains(marker.getLatLng())) {
                if((marker as any).id > 0) { // Anything with id <=0 should not be converted to an object
                  let obj:any = this.convertIdToObject((marker as any).id)
                  newArray.push(obj);
                }
              }
            }
          });
        }

        sortedArray.reload(newArray);
        this.visibleLayersRefreshed.emit(overlayName);
      }
    }
  }

  refreshAllVisibleMarkers() {
    this.layerGroupNames.forEach((layerGroupName: string) => {
      const layerGroup = this.layerGroups.get(layerGroupName);
      if (layerGroup) {
        this.refreshVisibleMarkers(layerGroupName);
      }
    });
  }

  // Reset the map center point & zoom.
  // This is just a passthrough to the map.
  public setMapView(center: L.LatLngExpression, zoom?: number, options?: L.ZoomPanOptions) {
    this.map.setView(center, zoom, options);
  }

  // Reset the map to fit the bounds of the provided Layer.
  public setMapBounds(latitude: number, longitude: number, radiusMiles: number) {
    const circle = L.circle([latitude, longitude], { radius: radiusMiles * 1609.344 });
    this.map.addLayer(circle);
    this.map.fitBounds(circle.getBounds());
    this.map.removeLayer(circle);
  }
}

