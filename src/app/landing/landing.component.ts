import { Component, OnInit, AfterViewInit } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { GlobalValuesService } from "../shared/global-values";
import { NavigationExtras, Router } from "@angular/router";

@Component({
    standalone: true,
    selector: 'app-map',
    imports: [
        MatIconModule,
        MatCardModule,
    ],
    templateUrl: './landing.component.html',
    styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit, AfterViewInit {
    constructor(
        private router: Router,
        public globalValuesService: GlobalValuesService,
    ) {}

    ngOnInit(): void {
    }

    ngAfterViewInit(): void {
    }

    browseTools(): void {
        // Get the selected radius.  Default 1 mile.
        const selectElement = document.getElementById('browseRadiusSelect') as HTMLSelectElement;
        const selectedValue = selectElement.value ? selectElement.value : 1;

        // Redirect to browse tools component
        const navigationExtras: NavigationExtras = {state: {radius: selectedValue}};
        this.router.navigate(['browse'], navigationExtras);
    }

    searchTools(): void {
        // Get the selected radius.  Default 1 mile.
        const inputElement = document.getElementById('searchTermsInputTools') as HTMLInputElement;
        const value = inputElement.value ? inputElement.value : "";

        // Redirect to browse tools component
        const navigationExtras: NavigationExtras = {state: {searchCriteria: value}};
        this.router.navigate(['browse'], navigationExtras);
    }

    searchNeighbors(): void {
        // Get the selected radius.  Default 1 mile.
        const inputElement = document.getElementById('searchTermsInputNeighbors') as HTMLInputElement;
        const value = inputElement.value ? inputElement.value : "";

        // Redirect to browse tools component
        const navigationExtras: NavigationExtras = {state: {searchCriteria: value}};
        this.router.navigate(['friends'], navigationExtras);
    }
}
