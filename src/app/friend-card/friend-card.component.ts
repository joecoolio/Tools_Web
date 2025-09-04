import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Neighbor, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';
import { DecimalPipe } from '@angular/common';
import { ConfirmationService } from '../services/confirmation.service';

export interface FriendCardDialogData {
  neighbor: Neighbor,
  fnRequestFriendship: (id: number, message: string) => void,
  fnCancelRequestFriendship: (id: number) => void,
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
  fnRequestFriendship!: (id: number, message: string) => void;
  fnCancelRequestFriendship!: (id: number) => void;
  fnDeleteFriendship!: (id: number) => void;

  ngOnInit(): void {
    this.neighbor = this.dialogData.neighbor;
    this.fnRequestFriendship = this.dialogData.fnRequestFriendship;
    this.fnCancelRequestFriendship = this.dialogData.fnCancelRequestFriendship;
    this.fnDeleteFriendship = this.dialogData.fnDeleteFriendship;
  }

  convertMetersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  // Create a friendship
  friend() {
    this.confirmationService.confirm(
      'Request Friendship',
      'This will send a friendship request to ' + this.neighbor.name + '.',
      [
        { name: 'message', label: 'Message To ' + this.neighbor.name, type: 'textarea', required: true },
      ],
      {
        message: "Won't you be my neighbor?",
      }
    )
    .subscribe(result => {
      if (result) {
        console.log("Creating friendship request with: " + this.neighbor.name);
        this.fnRequestFriendship(this.neighbor.id, result["message"]);

        this.dialogRef.close();
      }
    });
  }

  // Cancel a pending friend request
  cancelrequest() {
    this.confirmationService.confirm('Cancel Friend Request', 'Are you sure you want to cancel your friendship request with ' + this.neighbor.name + '?', [])
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Cancelling friendship request with: " + this.neighbor.name);
        this.fnCancelRequestFriendship(this.neighbor.id);

        this.dialogRef.close();
      }
    });
  }

  // Unfriend an existing friendship
  unfriend() {
    this.confirmationService.confirm('Unfriend', 'Are you sure you want to remove your friendship with ' + this.neighbor.name + '?', [])
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Deleting friendship with: " + this.neighbor.name);
        this.fnDeleteFriendship(this.neighbor.id);

        this.dialogRef.close();
      }
    });
  }
}
