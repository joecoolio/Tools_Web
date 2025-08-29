import { Component, effect, OnInit, Signal } from '@angular/core';
import { MatMenuModule } from "@angular/material/menu";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { Router, RouterModule } from '@angular/router';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MyInfoComponent } from './user/myinfo/myinfo.component';
import { AuthService } from './services/auth.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TokenService } from './services/token.service';
import { DataService, MyInfo } from './services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'Tools_Web';

  constructor(
    private dialog: MatDialog,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private tokenService: TokenService,
    private dataService: DataService,
  ) {
    // Monitor the loggedIn signal.
    // When it is false, clear myinfo (including picture and whatnot).
    // When it is true, immediately call getMyInfo().
    effect(() => {
      if(this.tokenService.isLoggedIn()) { // Link the effect to the proper signal so it functions
        console.log("App: running getMyInfo");
        this.dataService.getMyInfo().subscribe();
      } else {
        console.log("App: expiring my info");
        this.dataService.expireMyInfo.set(true);
      }
    });
  }

  loggedIn!: Signal<boolean>;
  myInfo!: Signal<MyInfo>;

  ngOnInit(): void {
    this.loggedIn = this.tokenService.isLoggedIn;
    this.myInfo = this.dataService.myInfoSignal;
  }

  openMyInfoDialog() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;

    this.dialog.open(MyInfoComponent, dialogConfig);
  }

  logout() {
    this.authService.logout();

    this.snackBar.open('Your have been logged out successfully!', '', {
      duration: 3000, // 3 seconds
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['custom-snackbar']
    });

    this.router.navigate(['login']);
  }
}
