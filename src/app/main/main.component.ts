import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatCardModule } from "@angular/material/card";
import { MapComponent } from "../map/map.component";
import {
  Map, Marker, MarkerOptions, Layer, tileLayer, MapOptions, latLng, icon, marker, LayerGroup, layerGroup, // Default stuff
  ExtraMarkers, // Fancy markers
  MarkerClusterGroup, MarkerClusterGroupOptions, markerClusterGroup, // Cluster groups
  Control
} from 'leaflet';
import { Neighbor, Tool } from '../services/data.service';

@Component({
  selector: 'app-main',
  imports: [MatCardModule, MapComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements AfterViewInit {
  @ViewChild('mapRef') map!: MapComponent;

  // All Tools/Neighbors that are in the current view on the map
  visibleTools!: Tool[];
  visibleNeighbors!: Neighbor[];

  ngAfterViewInit(): void {
    setTimeout(() => { // Avoid NG0100
      this.visibleTools = this.map.visibleTools;
      this.visibleNeighbors = this.map.visibleNeighbors;
    });
  }

  onVisibleNeighborCleared() {
    this.visibleNeighbors = this.map.visibleNeighbors;
  }

}
