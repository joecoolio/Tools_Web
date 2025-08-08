import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormControl, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NavigationExtras, Router, RouterLinkWithHref } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, LoginResult, RegisterData } from '../../services/auth.service';
import { TokenService } from '../../services/token.service';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [
    CommonModule,
    
    MatCardModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    
    RouterLinkWithHref,
  ]
})
export class RegisterComponent {

  constructor(
    private authService: AuthService,
    // private userService: UserService,
    public tokenService: TokenService,
    private router: Router,
  ) {
    this.errorMessage = "";
    this.loginRunning = false;

    // Get navigation data including any message
    const navigation = this.router.getCurrentNavigation();
    if (navigation == null || navigation.extras.state == null) {
      this.routerMessage = null;
    } else {
      const state = navigation.extras.state as {data: string};
      this.routerMessage = state.data;
    } 

  }

  ngOnInit() {
  }

  // If sent here from elsewhere, show the message explaining why
  routerMessage: string | null;

  // Form fields
  userid: FormControl = new FormControl('', [ Validators.email, Validators.required ]);
  name: FormControl = new FormControl('', [ Validators.required ]);
  password: FormControl = new FormControl('', [ Validators.required ]);
  address: FormControl = new FormControl('', [ Validators.required ]);

  // Toggle for hiding the password
  hidePassword = true;

  // The register form
  registerFormGroup: FormGroup = new FormGroup({
    userid: this.userid,
    name: this.name,
    password: this.password,
    address: this.address,
  });

  // Error message if anything goes wrong
  errorMessage: string;

  // Flags to indicate that buttons were pushed causing an API call to be running
  loginRunning: boolean;

  // Register a new user (non-guest)
  register(): void {
    this.loginRunning = true;

    let registerData: RegisterData = {
      userid: this.registerFormGroup.get('userid')?.value,
      name: this.registerFormGroup.get('name')?.value,
      password: this.registerFormGroup.get('password')?.value,
      address: this.registerFormGroup.get('address')?.value,
    }
    this.authService.register(registerData)
    .then(
      // Success callback
      (resp: HttpResponse<LoginResult>) => {
        console.log("Register success");
          
        this.loginRunning = false;

        // Ask for a validation email
        // this.sendVerificationEmail();

        // Redirect to the user settings page
        const navigationExtras: NavigationExtras = {state: {data: 'A registration email has been sent to you!'}};
        this.router.navigate(['map']);
      },
      (err) => {
        this.errorMessage = "Registration failed, user exists with a different password?"
        console.log("Register failure", err);
        this.loginRunning = false;
      }
    );
  }

  sendVerificationEmail() {
    // Ask for a validation email
    // this.userService.sendVerificationEmail();
  }
  
}
