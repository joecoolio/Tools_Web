import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmationService } from "../../services/confirmation.service";
import { DataService, MyInfo } from "../../services/data.service";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from "@angular/common/http";
import { ImageService } from "../../services/image.service";


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
    private sanitizer: DomSanitizer,
    public dialogRef: MatDialogRef<MyInfoComponent>,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private imageService: ImageService,
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
      .then((myInfo) => {
        this.myInfo = myInfo;

        // Update the form fields
        this.settingsForm.patchValue({
          userid: myInfo.userid,
          name: myInfo.name,
          nickname: myInfo.nickname,
          address: myInfo.home_address,
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
      .then((success) => this.addressValid = success);
    }
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.settingsForm.patchValue({ photo: file });
      // const reader = new FileReader();
      // reader.onload = () => this.photoPreview = reader.result;
      // reader.readAsDataURL(file);

      // this.photoChanged = true;

      this.imageService.resizeImageToPngBlob(file, 200, 200)
      .then((blob: Blob) => {
        this.photoPreview = URL.createObjectURL(blob);
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
    if (this.myInfo.photo_link) {
      this.dataService.getPicture(this.myInfo.photo_link)
      .then((blob: Blob) => {
        this.photoPreview = URL.createObjectURL(blob);
        this.loading = false; // Done loading all data
      })
      .catch(error => {
        // Check for invalid photo and load default
        if (error instanceof HttpErrorResponse && error.status == 404) {
          this.myInfo.photo_link = "default.svg";
          this.dataService.getPicture(this.myInfo.photo_link)
          .then((blob: Blob) => {
            this.photoPreview = URL.createObjectURL(blob);
            this.loading = false; // Done loading all data
          })
          .catch(error => {
            this.loading = false;
          })
        }
      });
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
      .then((value) => {
        this.loading = false;

        this.snackBar.open('Your settings were saved!', '', {
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
