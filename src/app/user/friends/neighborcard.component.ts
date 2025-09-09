import { Component, OnInit, Input } from "@angular/core";
import { DataService, MappableObject, Neighbor } from "../../services/data.service";
import { MatCardModule } from "@angular/material/card";

@Component({
  selector: 'app-friends-neighbor-card',
  standalone: true,
  templateUrl: './neighborcard.component.html',
  styleUrl: './neighborcard.component.scss',
  imports: [
    MatCardModule
  ]
})
export class NeighborCardComponent implements OnInit {
  @Input() object!: MappableObject;
  neighbor!: Neighbor;

  constructor(
    protected dataService: DataService,
  ) {
  }

  async ngOnInit() {
    this.neighbor = this.object as Neighbor;
    
    this.dataService.getNeighbor(this.neighbor.id).subscribe(n => this.neighbor = n );
  }
}
