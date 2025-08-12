import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';

@Component({
  standalone: true,
  selector: 'app-card',
  imports: [
    MatDialogModule
  ],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss'
})
export class CardComponent implements OnInit {
  constructor(
    private dataService: DataService,
    // public dialogRef: MatDialogRef<CardComponent>,
    // @Inject(MAT_DIALOG_DATA) public data: {
    //   requestType: string, // Either "tool" or "neighbor"
    //   id: number
    // }
  ) {
    // this.requestType = data.requestType;
    // this.id = data.id;
  }

  ngOnInit(): void {
    if (this.requestType == "tool") {
      console.log("Requesting tool: " + this.id);
      this.dataService.getTool(this.id).then(
        (tool: Tool) => {
          console.log("Retrieved tool: " + tool.id);
          this.name = tool.name;
        }
      );
    }
  }

  private requestType !: string;
  private id !: number;

  @Input() name: string = 'Pikachu';
  @Input() type: string = 'electric';
  @Input() hp: number = 60;
  @Input() attack: string = 'Thunder Shock';
  @Input() damage: number = 30;
  @Input() description: string = 'Pikachu stores electricity in its cheeks and releases it in lightning-based attacks.';
  @Input() imageUrl!: SafeUrl;// = 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/025.png';

}
