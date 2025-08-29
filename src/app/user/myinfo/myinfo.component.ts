import { Component, ElementRef, OnInit, SecurityContext, ViewChild } from "@angular/core";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DataService, MyInfo } from "../../services/data.service";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from "@angular/common/http";
import { ImageService } from "../../services/image.service";
import { DomSanitizer } from "@angular/platform-browser";


@Component({
  standalone: true,
  selector: 'app-card',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    FontAwesomeModule,
    MatSnackBarModule,
  ],
  templateUrl: './myinfo.component.html',
  styleUrl: './myinfo.component.scss'
})
export class MyInfoComponent implements OnInit {
  @ViewChild('photoInput', { static: false }) fileInput!: ElementRef;

  constructor(
    public dataService: DataService,
    public dialogRef: MatDialogRef<MyInfoComponent>,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private imageService: ImageService,
    private sanitizer: DomSanitizer,
  ) {  }
  
  faTrash = faTrash;
  loading: boolean = true; // Is data currently loading or not
  myInfo!: MyInfo; // Returned from API call
  settingsForm!: FormGroup; // Web form
  photoPreview: string | ArrayBuffer | null = null; // Photo in the preview box
  addressValid: boolean | undefined = undefined; // Flag indicating that whatever's in the address box is valid
  photoChanged: boolean = false; // Flag indicating that the user selected a new photo

  ngOnInit(): void {
    // Setup form
    this.settingsForm = this.fb.group({
      userid: ['', Validators.required],
      password: [''],
      name: ['', Validators.required],
      nickname: [''],
      address: ['', Validators.required],
      photo: [null],
    });

    // Get MyInfo from the database
    this.dataService.getMyInfo()
      .subscribe(myInfoSignal => {
        this.myInfo = myInfoSignal();

        // Update the form fields
        this.settingsForm.patchValue({
          userid: this.myInfo.userid,
          name: this.myInfo.name,
          nickname: this.myInfo.nickname,
          address: this.myInfo.home_address,
        });
        this.validateAddress();

        // Get my image if there is one
        this.resetPhoto();
      });
  }

  validateAddress() {
    const value: string = this.settingsForm.get('address')?.value;
    if (value && value.length > 1) {
      this.dataService.validateAddress(value)
      .subscribe(success => this.addressValid = success);
    }
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imageService.resizeImageToDataUrl(file, 200, 200)
      .subscribe(url => {
        this.settingsForm.patchValue({ photo: url });    
        this.photoPreview = url;
        this.photoChanged = true;
      });
    }
  }

  // Reset the photo input to the original value
  resetPhoto(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = null;
      this.photoPreview = null;
    }
    if (this.myInfo.imageUrl) {
      this.photoPreview = this.sanitizer.sanitize(SecurityContext.URL, this.myInfo.imageUrl) ?? '';
      this.loading = false; // Done loading all data
    }
    this.photoChanged = false;
  }

  onSubmit(): void {
    if (this.settingsForm.valid) {
      const formData = new FormData();
      Object.entries(this.settingsForm.value).forEach(([key, value]) => {
        formData.append(key, value as string | Blob);
      });

      // Send the data away
      this.loading = true;
      this.dataService.updateMyInfo(formData)
      .subscribe(value => {
        this.loading = false;

        this.snackBar.open('Your tool was updated!', '', {
          duration: 3000, // 3 seconds
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['custom-snackbar']
        });

        this.dialogRef.close();
      })
    }
  }

}
