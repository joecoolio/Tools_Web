import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FieldConfig } from '../services/confirmation.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatInputModule,
    MatSelectModule
]
})
export class ConfirmDialogComponent {
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,

    @Inject(MAT_DIALOG_DATA) public data: { title: string; message: string, fields: FieldConfig[], initialData: any }
  ) {
    this.form = this.fb.group({});
    data.fields.forEach(field => {
      this.form.addControl(field.name, this.fb.control(data.initialData[field.name] || ''));
    });
  }

  form: FormGroup;

  confirm(): void {
    this.dialogRef.close(this.form.value);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
