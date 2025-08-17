import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Neighbor, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';
import { DecimalPipe } from '@angular/common';
import { ConfirmationService } from '../services/confirmation.service';

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
    public dialogRef: MatDialogRef<CardComponent>,
    private confirmationService: ConfirmationService,
    @Inject(MAT_DIALOG_DATA) public neighbor: Neighbor,
  ) {
  }

  ngOnInit(): void {
  }

  convertMetersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  // Create a friendship
  friend() {
    console.log("Creating friendship with: " + this.neighbor.name);
  }

  // Unfriend an existing friendship
  unfriend() {
    this.confirmationService.confirm('Unfriend', 'Are you sure you want to remove your friendship with ' + this.neighbor.name + '?')
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Deleting friendship with: " + this.neighbor.name);
      }
    });

  }
}
