import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Neighbor, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ConfirmationService } from '../services/confirmation.service';

export interface ToolCardDialogData {
  tool: Tool,
  fnBorrow: (id: number, message: string) => void,
  fnCancelBorrow: (id: number) => void,
}

@Component({
  standalone: true,
  selector: 'app-tool-card',
  imports: [
    MatDialogModule,
    DecimalPipe,
    CurrencyPipe,
  ],
  templateUrl: './tool-card.component.html',
  styleUrl: './tool-card.component.scss'
})
export class ToolCardComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<ToolCardComponent>,
    private confirmationService: ConfirmationService,
    @Inject(MAT_DIALOG_DATA) private dialogData: ToolCardDialogData,
  ) {
  }

  // Stuff passed in the constructor
  tool!: Tool;
  fnBorrow!: (id: number, message: string) => void;
  fnCancelBorrow!: (id: number) => void;

  ngOnInit(): void {
    this.tool = this.dialogData.tool;
    this.fnBorrow = this.dialogData.fnBorrow;
    this.fnCancelBorrow = this.dialogData.fnCancelBorrow;
  }

  convertMetersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  // Borrow this tool
  borrow() {
    this.confirmationService.confirm(
      'Ask to Borrow',
      'This will send a borrow request to ' + this.tool.ownerName + '.',
      [
        { name: 'message', label: 'Message To ' + this.tool.ownerName, type: 'textarea', required: true },
      ],
      {
        message: "Can I please borrow your " + this.tool.short_name + "?",
      }
    )
    .subscribe(result => {
      if (result) {
        console.log("Sending borrow request to: " + this.tool.ownerName);
        this.fnBorrow(this.tool.id, result["message"]);

        this.dialogRef.close();
      }
    });
  }

  // Cancel a pending friend request
  cancelrequest() {
    this.confirmationService.confirm('Cancel Borrow Request', 'Are you sure you want to cancel your  request to borrow ' +
      this.tool.ownerName + "'s " + this.tool.short_name, [])
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Cancelling borrow request with: " + this.tool.ownerName + " for " + this.tool.short_name);
        this.fnCancelBorrow(this.tool.id);

        this.dialogRef.close();
      }
    });
  }
}
