import { Component, ElementRef, ViewChild } from '@angular/core';
import { Validators, FormGroup, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterLinkWithHref } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { TokenService } from '../../services/token.service';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DataService } from '../../services/data.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [
    MatTooltipModule,
    ReactiveFormsModule,
    FontAwesomeModule,    
    RouterLinkWithHref,
  ]
})
export class RegisterComponent {
  @ViewChild('photoInput', { static: false }) fileInput!: ElementRef;

  faTrash = faTrash;
  settingsForm!: FormGroup; // Web form
  photoPreview: string | ArrayBuffer | null = null; // Photo in the preview box
  addressValid: boolean | undefined = undefined; // Flag indicating that whatever's in the address box is valid
  photoChanged: boolean = false; // Flag indicating that the user selected a new photo
  
  constructor(
    public tokenService: TokenService,
    public dataService: DataService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private imageService: ImageService,
    private authService: AuthService,
  ) {  }

  ngOnInit() {
    // Setup form
    this.settingsForm = this.fb.group({
      userid: ['', Validators.required],
      password: ['', Validators.required],
      name: ['', Validators.required],
      nickname: [''],
      address: ['', Validators.required],
      photo: [null, Validators.required],
    });
  }

  // Toggle for hiding the password
  hidePassword = true;

  // Flags to indicate that buttons were pushed causing an API call to be running
  loading: boolean = false;

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
      this.settingsForm.patchValue({ photo: file });
      this.imageService.resizeImageToPngBlob(file, 200, 200)
      .subscribe((blob: Blob) => {
        this.photoPreview = URL.createObjectURL(blob);
        this.photoChanged = true;
      });
    }
  }

  // Reset the photo input to the original value
  resetPhoto(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = null;
    }
    this.photoPreview = null;
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
      this.authService.register(formData)
      .subscribe(() => {
        this.loading = false;

        this.snackBar.open('Your account was created!', '', {
          duration: 3000, // 3 seconds
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['custom-snackbar']
        });
      })
    }
  }
}
