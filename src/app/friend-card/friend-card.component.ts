import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Neighbor, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';
import { DecimalPipe } from '@angular/common';
import { ConfirmationService } from '../services/confirmation.service';

export interface FriendCardDialogData {
  neighbor: Neighbor,
  fnCreateFriendship: (id: number) => void,
  fnDeleteFriendship: (id: number) => void,
}

@Component({
  standalone: true,
  selector: 'app-card',
  imports: [
    MatDialogModule,
    DecimalPipe,
  ],
  templateUrl: './friend-card.component.html',
  styleUrl: './friend-card.component.scss'
})
export class FriendCardComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<FriendCardComponent>,
    private confirmationService: ConfirmationService,
    @Inject(MAT_DIALOG_DATA) private dialogData: FriendCardDialogData,
  ) {
  }

  // Stuff passed in the constructor
  neighbor!: Neighbor;
  fnCreateFriendship!: (id: number) => void;
  fnDeleteFriendship!: (id: number) => void;

  ngOnInit(): void {
    this.neighbor = this.dialogData.neighbor;
    this.fnCreateFriendship = this.dialogData.fnCreateFriendship;
    this.fnDeleteFriendship = this.dialogData.fnDeleteFriendship;
  }

  convertMetersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  // Create a friendship
  friend() {
    this.confirmationService.confirm('Request Friendship', 'This will send a friendship request to ' + this.neighbor.name + '.')
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Creating friendship with: " + this.neighbor.name);
        this.fnCreateFriendship(this.neighbor.id);

        this.dialogRef.close();
      }
    });
  }

  // Unfriend an existing friendship
  unfriend() {
    this.confirmationService.confirm('Unfriend', 'Are you sure you want to remove your friendship with ' + this.neighbor.name + '?')
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Deleting friendship with: " + this.neighbor.name);
        this.fnDeleteFriendship(this.neighbor.id);

        this.dialogRef.close();
      }
    });
  }
}
