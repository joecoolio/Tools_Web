import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NavigationExtras, Router, RouterLinkWithHref } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { MessageService } from '../../services/message.service';

@Component({
  standalone: true,
  selector: 'login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
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
export class LoginComponent {

  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private router: Router,
    private messageService: MessageService,
  ) {
    this.errorMessage = "";
    this.loading = false;

    // Get navigation data including any message
    const navigation = this.router.getCurrentNavigation();
    if (navigation == null || navigation.extras.state == null) {
      this.routerMessage = null;
    } else {
      const state = navigation.extras.state as {data: string};
      this.routerMessage = state.data;
      console.log("Reset message: " + this.routerMessage);
    }
  }

  ngOnInit() {
  }

  // If sent here from elsewhere, show the message explaining why
  routerMessage: string | null;

  // Form fields
  userid: FormControl = new FormControl('', [Validators.required ]);
  password: FormControl = new FormControl('', [Validators.required ]);

  // The login form
  loginFormGroup: FormGroup = new FormGroup({
    userid: this.userid,
    password: this.password
  });

  // Toggle for hiding the password
  hidePassword = true;

  // Error message if anything goes wrong
  errorMessage: string;

  // Flags to indicate that buttons were pushed causing an API call to be running
  loading: boolean;

  // Login an existing user
  login(): void {
    this.loading = true;

    this.authService.login(this.userid.value, this.password.value)
    .subscribe({
      // Success
      next: (resp) => {
        this.loading = false;

        // Redirect to the main page
        const navigationExtras: NavigationExtras = {state: {data: 'Login Successful!'}};
        this.router.navigate(['home']);
      },
      complete: () => {
        this.messageService.send('info', "Welcome back!");

        // Go ahead and load up the neighbor for my ID.
        // This will ensure my info is cached as well as the picture.
        this.dataService.expireMyInfo.set(true);
        this.dataService.getMyInfo();
      },
      // Failure
      error: (err) => {
        this.errorMessage = "Login failed, try again?"
        console.log("LoginComponent: Login failure", err);
        this.loading = false;
      }
    });
  }

}
