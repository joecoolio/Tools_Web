import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DataService, Neighbor, Tool } from '../services/data.service';
import { SafeUrl } from '@angular/platform-browser';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ConfirmationService } from '../services/confirmation.service';
import { ToolPlusOwner } from '../browsetools/browsetools.component';

export interface ToolCardDialogData {
  tool: ToolPlusOwner,
  fnBorrow: (id: number) => void,
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
  tool!: ToolPlusOwner;
  fnBorrow!: (id: number) => void;

  ngOnInit(): void {
    this.tool = this.dialogData.tool;
    this.fnBorrow = this.dialogData.fnBorrow;
  }

  convertMetersToMiles(meters: number): number {
    return meters * 0.000621371;
  }

  // Borrow this tool
  borrow() {
    this.confirmationService.confirm('Ask to Borrow', 'This will send a borrow request to ' + this.tool.ownerName + '.', [])
    .subscribe(confirmed => {
      if (confirmed) {
        console.log("Sending borrow request to: " + this.tool.ownerName);
        this.fnBorrow(this.tool.id);

        this.dialogRef.close();
      }
    });
  }
}
