import { Component, OnInit, AfterViewInit } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";

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
    constructor() {}

    ngOnInit(): void {
    }
    ngAfterViewInit(): void {
    }
}
