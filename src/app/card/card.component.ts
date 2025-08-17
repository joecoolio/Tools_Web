import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Neighbor, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';
import { DecimalPipe } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-card',
  imports: [
    MatDialogModule,
    DecimalPipe,
  ],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss'
})
export class CardComponent implements OnInit {
  constructor(
    private dataService: DataService,
    public dialogRef: MatDialogRef<CardComponent>,
    @Inject(MAT_DIALOG_DATA) public neighbor: Neighbor,
  ) {
  }

  ngOnInit(): void {
  }

  private requestType !: string;
  private id !: number;

  convertMetersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  // Create a friendship
  friend() {
    console.log("Creating friendship with: " + this.neighbor.name);
  }

  // Unfriend an existing friendship
  unfriend() {
    console.log("Deleting friendship with: " + this.neighbor.name);
  }
}
