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
import { SortedArray } from '../services/sortedarray';

@Component({
  selector: 'app-main',
  imports: [MatCardModule, MapComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements AfterViewInit {
  @ViewChild('mapRef') map!: MapComponent;

  // All Tools/Neighbors that are in the current view on the map
  visibleTools!: SortedArray<Tool>;
  visibleNeighbors!: SortedArray<Neighbor>;

  ngAfterViewInit(): void {
    setTimeout(() => { // Avoid NG0100
      this.visibleTools = this.map.visibleTools;
      this.visibleNeighbors = this.map.visibleNeighbors;
    });
  }

  onVisibleNeighborsCleared() {
    this.visibleNeighbors = this.map.visibleNeighbors;
  }
  onVisibleToolsCleared() {
    this.visibleTools = this.map.visibleTools;
  }

}
