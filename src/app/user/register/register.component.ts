import { Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { Validators, FormGroup, ReactiveFormsModule, FormBuilder, AbstractControl, ValidationErrors } from '@angular/forms';
import { NavigationExtras, Router, RouterLinkWithHref } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService, RegisterData } from '../../services/auth.service';
import { TokenService } from '../../services/token.service';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DataService } from '../../services/data.service';
import { ImageService } from '../../services/image.service';
import { MessageService } from '../../services/message.service';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { EMPTY, finalize, map, Observable } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [
    CommonModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    RouterLinkWithHref,
    MatTooltipModule,
    FontAwesomeModule,
    MatIconModule,
  ]
})
export class RegisterComponent {
  @ViewChild('photoInput', { static: false }) fileInput!: ElementRef;

  faTrash = faTrash;
  settingsForm!: FormGroup; // Web form
  photoPreview: string | ArrayBuffer | null = null; // Photo in the preview box
  
  constructor(
    public tokenService: TokenService,
    public dataService: DataService,
    private router: Router,
    private fb: FormBuilder,
    private imageService: ImageService,
    private authService: AuthService,
    private messageService: MessageService,
    private zone: NgZone,
  ) {
    this.errorMessage = "";
    this.loading = false;
  }

  ngOnInit() {
    // Setup form
    this.settingsForm = this.fb.group({
      login: this.fb.group({
        userid: ['', {
          validators: [Validators.required],
          asyncValidators: [this.validateUserid.bind(this)],
          updateOn: 'blur'
        }],
        password: ['', Validators.required],
      }),
      personal: this.fb.group({
        name: ['', Validators.required],
        nickname: [''],
        address: ['', {
          validators: [Validators.required],
          asyncValidators: [this.validateAddress.bind(this)],
          updateOn: 'blur'
        }],
        phone_number: ['', [ Validators.required, Validators.pattern(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/)]],
        email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      }),
      photo: this.fb.group({
        photo: [null, Validators.required],
      }),
    });
  }

  // Which form step are we on
  currentStep = 1;

  // Toggle for hiding the password
  hidePassword = true;

  // Error message if anything goes wrong
  errorMessage: string;

  // Flags to indicate that buttons were pushed causing an API call to be running
  loading: boolean = false;
  validatingUserid: boolean = false;
  validatingAddress: boolean = false;

  validateUserid(control: AbstractControl): Observable<ValidationErrors | null> {
    this.validatingUserid = true;
    const value: string = control.value;
    if (value && value.length > 1) {
      return this.dataService.useridIsAvailable(control.value).pipe(
        map(valid => valid ? null : { alreadyInUse: true }),
        finalize(() => this.validatingUserid = false)
      );
    } else {
      return EMPTY;
    }
  }

  // Make sure that an address lookup works for this guy.
  // Otherwise, we can't map it later.
  validateAddress(control: AbstractControl): Observable<ValidationErrors | null> {
    this.validatingAddress = true;
    const value: string = control.value;
    if (value && value.length > 1) {
      return this.dataService.validateAddress(control.value).pipe(
        map(valid => valid ? null : { invalidAddress: true }),
        finalize(() => this.validatingAddress = false)
      );
    } else {
      return EMPTY;
    }
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imageService.resizeImageToPngBlob(file, 200, 200)
      .subscribe((blob: Blob) => {
        this.zone.run(() => {
          this.settingsForm.get("photo")?.patchValue({ photo: blob });
          this.photoPreview = URL.createObjectURL(blob);
        });
      });
    }
  }

  // Reset the photo input to the original value
  resetPhoto(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = null;
    }
    this.settingsForm.get("photo")?.patchValue({ photo: null });
    this.photoPreview = null;
  }
  
  // Methods to navigate between steps
  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }
  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  onSubmit(): void {
    if (this.settingsForm.valid) {
      const formData = new FormData();
      Object.entries(this.settingsForm.get('login')?.value).forEach(([key, value]) => {
        formData.append(key, value as string | Blob);
      });
      Object.entries(this.settingsForm.get('personal')?.value).forEach(([key, value]) => {
        formData.append(key, value as string | Blob);
      });
      Object.entries(this.settingsForm.get('photo')?.value).forEach(([key, value]) => {
        formData.append(key, value as string | Blob);
      });

      // Send the data away
      this.loading = true;
      this.authService.register(formData)
      .subscribe({
        // Success
        next: (resp) => {
          this.loading = false;

          // Redirect to the main page
          const navigationExtras: NavigationExtras = {state: {data: 'Login Successful!'}};
          this.router.navigate(['home']);
        },
        complete: () => {
          this.messageService.send('info', 'Your account was created!');

          // Go ahead and load up the neighbor for my ID.
          // This will ensure my info is cached as well as the picture.
          this.dataService.expireMyInfo.set(true);
          this.dataService.getMyInfo();
        },
        // Failure
        error: (err) => {
          this.errorMessage = "Account creation failed, try again?"
          console.log("LoginComponent: Login failure", err);
          this.loading = false;
        }
      })
    }
  }
}
