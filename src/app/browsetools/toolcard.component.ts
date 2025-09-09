import { Component, OnInit, Input } from "@angular/core";
import { DataService, MappableObject, Tool } from "../services/data.service";
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from "@angular/material/tooltip";

@Component({
  selector: 'app-browse-tool-card',
  standalone: true,
  templateUrl: './toolcard.component.html',
  styleUrl: './toolcard.component.scss',
  imports: [
    MatCardModule,
    MatTooltipModule,
  ]
})
export class BrowseToolsToolCardComponent implements OnInit {
  @Input() object!: MappableObject;
  @Input() showOwner: boolean = true; // If true, the owner is drawn in the corner
  tool!: Tool;

  constructor(
    protected dataService: DataService,
  ) {
  }

  async ngOnInit() {
    this.tool = this.object as Tool;
    
    this.dataService.getTool(this.tool.id, this.showOwner).subscribe(t => this.tool = t);
  }
}
